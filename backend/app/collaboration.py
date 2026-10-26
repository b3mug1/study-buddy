import logging
from datetime import UTC, datetime
from urllib.parse import quote, urlsplit
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.auth import CurrentUser
from app.database import DatabaseError, database_connection
from app.profiles import _database_error
from app.schemas import (
    GroupFocusSessionCreate,
    GroupTaskCreate,
    GroupTaskUpdate,
    SafetyReportCreate,
    StudyGoalCreate,
    StudyGoalTopicCreate,
    StudyGoalTopicUpdate,
    StudyGoalUpdate,
    UserBlockCreate,
)

router = APIRouter(prefix="/api/v1", tags=["study collaboration"])
logger = logging.getLogger(__name__)
FILE_LIMIT = 5 * 1024 * 1024
ALLOWED_FILE_TYPES = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
OPTIONAL_GROUP_FILE = File(default=None)


def _require_group_member(connection, group_id: UUID, student_id: UUID) -> dict:
    group = connection.execute(
        """select g.id,g.owner_id,g.name,g.subject,gm.role
           from study_groups g join group_members gm on gm.group_id=g.id
           where g.id=%s and gm.student_id=%s""",
        (group_id, student_id),
    ).fetchone()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found or you are not a member.",
        )
    return group


def _require_group_assignee(connection, group_id: UUID, student_id: UUID | None) -> None:
    if student_id is None:
        return
    member = connection.execute(
        "select 1 from group_members where group_id=%s and student_id=%s",
        (group_id, student_id),
    ).fetchone()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assign this task to a member of the study group.",
        )


def _notify(
    connection,
    user_id: UUID,
    kind: str,
    title: str,
    body: str,
    entity_type: str,
    entity_id: UUID,
) -> None:
    connection.execute(
        """insert into notifications(user_id,kind,title,body,entity_type,entity_id)
           values (%s,%s,%s,%s,%s,%s)""",
        (user_id, kind, title, body[:500], entity_type, entity_id),
    )


@router.get("/groups/{group_id}/tasks")
def list_group_tasks(group_id: UUID, user: CurrentUser) -> list[dict]:
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            rows = connection.execute(
                """select t.id,t.group_id,t.created_by,t.assigned_to,t.title,t.description,
                          t.status,t.due_at,t.created_at,t.updated_at,
                          creator.full_name as creator_name,assignee.full_name as assignee_name
                   from group_tasks t
                   join profiles creator on creator.id=t.created_by
                   left join profiles assignee on assignee.id=t.assigned_to
                   where t.group_id=%s
                   order by (t.status='done'),t.due_at nulls last,t.created_at desc""",
                (group_id,),
            ).fetchall()
        return rows
    except DatabaseError as error:
        logger.exception("Failed to list group tasks")
        raise _database_error("load group tasks") from error


@router.post("/groups/{group_id}/tasks", status_code=status.HTTP_201_CREATED)
def create_group_task(group_id: UUID, task: GroupTaskCreate, user: CurrentUser) -> dict:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            group = _require_group_member(connection, group_id, user_id)
            _require_group_assignee(connection, group_id, task.assigned_to)
            row = connection.execute(
                """insert into group_tasks
                   (group_id,created_by,assigned_to,title,description,due_at)
                   values (%s,%s,%s,%s,%s,%s)
                   returning id,group_id,created_by,assigned_to,title,description,status,due_at,
                             created_at,updated_at""",
                (
                    group_id,
                    user_id,
                    task.assigned_to,
                    task.title,
                    task.description,
                    task.due_at,
                ),
            ).fetchone()
            if task.assigned_to and task.assigned_to != user_id:
                _notify(
                    connection,
                    task.assigned_to,
                    "group_task_assigned",
                    "New group task",
                    f"{group['name']}: {task.title}",
                    "study_group",
                    group_id,
                )
        return row
    except DatabaseError as error:
        logger.exception("Failed to create a group task")
        raise _database_error("create the group task") from error


@router.patch("/groups/{group_id}/tasks/{task_id}")
def update_group_task(
    group_id: UUID,
    task_id: UUID,
    task: GroupTaskUpdate,
    user: CurrentUser,
) -> dict:
    user_id = UUID(user.id)
    updates = task.model_dump(exclude_unset=True)
    updates = {
        key: value
        for key, value in updates.items()
        if value is not None or key in {"assigned_to", "due_at"}
    }
    if not updates:
        raise HTTPException(status_code=400, detail="Choose at least one field to update.")
    try:
        with database_connection(user.id) as connection:
            group = _require_group_member(connection, group_id, user_id)
            current = connection.execute(
                "select * from group_tasks where id=%s and group_id=%s for update",
                (task_id, group_id),
            ).fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Group task not found.")
            can_manage = current["created_by"] == user_id or group["owner_id"] == user_id
            if not can_manage and not (
                current["assigned_to"] == user_id and set(updates) == {"status"}
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Only the task creator, group owner, or assignee can make this change.",
                )
            if "assigned_to" in updates:
                _require_group_assignee(connection, group_id, updates["assigned_to"])
            columns = {
                "title": "title",
                "description": "description",
                "assigned_to": "assigned_to",
                "due_at": "due_at",
                "status": "status",
            }
            assignments = ", ".join(f"{columns[key]}=%s" for key in updates)
            row = connection.execute(
                f"update group_tasks set {assignments} where id=%s and group_id=%s "
                "returning id,group_id,created_by,assigned_to,title,description,status,due_at,"
                "created_at,updated_at",
                (*updates.values(), task_id, group_id),
            ).fetchone()
            if updates.get("assigned_to") and updates["assigned_to"] != current["assigned_to"]:
                _notify(
                    connection,
                    updates["assigned_to"],
                    "group_task_assigned",
                    "Task assigned to you",
                    f"{group['name']}: {current['title']}",
                    "study_group",
                    group_id,
                )
        return row
    except DatabaseError as error:
        logger.exception("Failed to update a group task")
        raise _database_error("update the group task") from error


@router.delete("/groups/{group_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_task(group_id: UUID, task_id: UUID, user: CurrentUser) -> None:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, user_id)
            result = connection.execute(
                """delete from group_tasks t using study_groups g
                   where t.id=%s and t.group_id=%s and g.id=t.group_id
                     and (t.created_by=%s or g.owner_id=%s) returning t.id""",
                (task_id, group_id, user_id, user_id),
            ).fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Task not found or cannot be deleted.")
    except DatabaseError as error:
        logger.exception("Failed to delete a group task")
        raise _database_error("delete the group task") from error


@router.get("/groups/{group_id}/materials")
def list_group_materials(group_id: UUID, user: CurrentUser) -> list[dict]:
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            return connection.execute(
                """select m.id,m.group_id,m.created_by,m.title,m.description,m.source_url,
                          m.file_name,m.created_at,p.full_name as creator_name,
                          (m.file_data is not null) as has_file
                   from group_materials m join profiles p on p.id=m.created_by
                   where m.group_id=%s order by m.created_at desc""",
                (group_id,),
            ).fetchall()
    except DatabaseError as error:
        logger.exception("Failed to list group materials")
        raise _database_error("load group materials") from error


@router.post("/groups/{group_id}/materials", status_code=status.HTTP_201_CREATED)
async def create_group_material(
    group_id: UUID,
    user: CurrentUser,
    title: str = Form(min_length=2, max_length=120),
    description: str = Form(default="", max_length=1000),
    source_url: str | None = Form(default=None, max_length=2048),
    file: UploadFile | None = OPTIONAL_GROUP_FILE,
) -> dict:
    clean_title = title.strip()
    clean_description = description.strip()
    clean_url = source_url.strip() if source_url else None
    if len(clean_title) < 2:
        raise HTTPException(
            status_code=422, detail="Material title must contain at least two characters."
        )
    if clean_url and file:
        raise HTTPException(status_code=422, detail="Add either a link or a file, not both.")
    if not clean_url and not file:
        raise HTTPException(status_code=422, detail="Add a link or choose a file.")

    file_data = None
    filename = None
    mime_type = None
    if clean_url:
        parsed = urlsplit(clean_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username
            or parsed.password
        ):
            raise HTTPException(status_code=422, detail="Use a valid HTTP or HTTPS link.")
    else:
        raw_filename = (file.filename or "").replace("\\", "/").split("/")[-1]
        filename = raw_filename
        extension = "." + raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else ""
        mime_type = ALLOWED_FILE_TYPES.get(extension)
        if not filename or not mime_type:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Supported files: PDF, TXT, Markdown, Word, PowerPoint, Excel, PNG, and JPG."
                ),
            )
        file_data = await file.read(FILE_LIMIT + 1)
        if not file_data or len(file_data) > FILE_LIMIT:
            raise HTTPException(status_code=413, detail="Files must be between 1 byte and 5 MB.")
        filename = filename.replace("\r", "").replace("\n", "")[:255]
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            row = connection.execute(
                """insert into group_materials
                   (group_id,created_by,title,description,source_url,file_name,mime_type,file_data)
                   values (%s,%s,%s,%s,%s,%s,%s,%s)
                   returning id,group_id,created_by,title,description,source_url,file_name,"
                "created_at""",
                (
                    group_id,
                    UUID(user.id),
                    clean_title,
                    clean_description,
                    clean_url,
                    filename,
                    mime_type,
                    file_data,
                ),
            ).fetchone()
        return row
    except DatabaseError as error:
        logger.exception("Failed to add a group material")
        raise _database_error("add the shared material") from error


@router.get("/groups/{group_id}/materials/{material_id}/file")
def download_group_material(group_id: UUID, material_id: UUID, user: CurrentUser) -> Response:
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            material = connection.execute(
                """select file_name,mime_type,file_data from group_materials
                   where id=%s and group_id=%s and file_data is not null""",
                (material_id, group_id),
            ).fetchone()
        if not material:
            raise HTTPException(status_code=404, detail="Shared file not found.")
        safe_name = quote(material["file_name"], safe="")
        return Response(
            content=material["file_data"],
            media_type=material["mime_type"],
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
            },
        )
    except DatabaseError as error:
        logger.exception("Failed to download a group material")
        raise _database_error("download the shared file") from error


@router.delete("/groups/{group_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_material(group_id: UUID, material_id: UUID, user: CurrentUser) -> None:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, user_id)
            deleted = connection.execute(
                """delete from group_materials m where m.id=%s and m.group_id=%s
                     and (m.created_by=%s or exists (
                       select 1 from study_groups g where g.id=m.group_id and g.owner_id=%s
                     )) returning m.id""",
                (material_id, group_id, user_id, user_id),
            ).fetchone()
            if not deleted:
                raise HTTPException(
                    status_code=404, detail="Material not found or cannot be deleted."
                )
    except DatabaseError as error:
        logger.exception("Failed to delete a group material")
        raise _database_error("delete the shared material") from error


@router.get("/groups/{group_id}/focus")
def get_group_focus(group_id: UUID, user: CurrentUser) -> dict | None:
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            focus = connection.execute(
                """select f.id,f.group_id,f.started_by,p.full_name as started_by_name,
                          f.focus_minutes,f.break_minutes,f.status,f.started_at,
                          f.started_at + make_interval(mins => f.focus_minutes) as ends_at
                   from group_focus_sessions f join profiles p on p.id=f.started_by
                   where f.group_id=%s and f.status='running'
                   order by f.started_at desc limit 1 for update of f""",
                (group_id,),
            ).fetchone()
            if not focus:
                return None
            if focus["ends_at"] <= datetime.now(UTC):
                connection.execute(
                    "update group_focus_sessions set status='completed',ended_at=now() where id=%s",
                    (focus["id"],),
                )
                return None
        return focus
    except DatabaseError as error:
        logger.exception("Failed to load the group focus session")
        raise _database_error("load the group focus session") from error


@router.post("/groups/{group_id}/focus", status_code=status.HTTP_201_CREATED)
def start_group_focus(
    group_id: UUID,
    focus: GroupFocusSessionCreate,
    user: CurrentUser,
) -> dict:
    try:
        with database_connection(user.id) as connection:
            group = _require_group_member(connection, group_id, UUID(user.id))
            connection.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s,0))",
                (f"group-focus:{group_id}",),
            )
            active = connection.execute(
                """select 1 from group_focus_sessions
                   where group_id=%s and status='running'
                     and started_at + make_interval(mins => focus_minutes)>now()
                   for update""",
                (group_id,),
            ).fetchone()
            if active:
                raise HTTPException(status_code=409, detail="A focus session is already running.")
            row = connection.execute(
                """insert into group_focus_sessions(group_id,started_by,focus_minutes,break_minutes)
                   values (%s,%s,%s,%s)
                   returning id,group_id,started_by,focus_minutes,break_minutes,status,started_at,
                     started_at + make_interval(mins => focus_minutes) as ends_at""",
                (group_id, UUID(user.id), focus.focus_minutes, focus.break_minutes),
            ).fetchone()
            members = connection.execute(
                "select student_id from group_members where group_id=%s and student_id<>%s",
                (group_id, UUID(user.id)),
            ).fetchall()
            for member in members:
                _notify(
                    connection,
                    member["student_id"],
                    "group_focus_started",
                    "Group focus session started",
                    f"{group['name']} is focusing together for {focus.focus_minutes} minutes.",
                    "study_group",
                    group_id,
                )
        return row
    except DatabaseError as error:
        logger.exception("Failed to start a group focus session")
        raise _database_error("start the group focus session") from error


@router.post("/groups/{group_id}/focus/{focus_id}/finish", status_code=status.HTTP_204_NO_CONTENT)
def finish_group_focus(group_id: UUID, focus_id: UUID, user: CurrentUser) -> None:
    try:
        with database_connection(user.id) as connection:
            _require_group_member(connection, group_id, UUID(user.id))
            row = connection.execute(
                """update group_focus_sessions set status='completed',ended_at=now()
                   where id=%s and group_id=%s and status='running' returning id""",
                (focus_id, group_id),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Running focus session not found.")
    except DatabaseError as error:
        logger.exception("Failed to finish the group focus session")
        raise _database_error("finish the group focus session") from error


@router.get("/goals")
def list_study_goals(user: CurrentUser) -> list[dict]:
    try:
        with database_connection(user.id) as connection:
            goals = connection.execute(
                """select g.id,g.subject,g.target_sessions,g.target_date,g.created_at,g.updated_at,
                     (select count(*) from study_sessions s
                       join session_participants sp on sp.session_id=s.id
                       where sp.student_id=g.user_id and sp.status='accepted'
                         and s.status='completed' and lower(s.subject)=lower(g.subject)
                         and s.starts_at>=date_trunc('week',now())) as completed_this_week
                   from study_goals g where g.user_id=%s
                   order by g.target_date nulls last,g.created_at""",
                (UUID(user.id),),
            ).fetchall()
            if not goals:
                return []
            goal_ids = [goal["id"] for goal in goals]
            topics = connection.execute(
                """select id,goal_id,topic,completed,completed_at,created_at
                   from study_goal_topics where goal_id=any(%s) order by created_at""",
                (goal_ids,),
            ).fetchall()
            topics_by_goal: dict[UUID, list[dict]] = {}
            for topic in topics:
                topics_by_goal.setdefault(topic["goal_id"], []).append(topic)
            for goal in goals:
                goal["topics"] = topics_by_goal.get(goal["id"], [])
            return goals
    except DatabaseError as error:
        logger.exception("Failed to list study goals")
        raise _database_error("load study goals") from error


@router.post("/goals", status_code=status.HTTP_201_CREATED)
def create_study_goal(goal: StudyGoalCreate, user: CurrentUser) -> dict:
    try:
        with database_connection(user.id) as connection:
            row = connection.execute(
                """insert into study_goals(user_id,subject,target_sessions,target_date)
                   values (%s,%s,%s,%s)
                   returning id,subject,target_sessions,target_date,created_at,updated_at""",
                (UUID(user.id), goal.subject, goal.target_sessions, goal.target_date),
            ).fetchone()
        return row
    except DatabaseError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=409, detail="A goal for this subject already exists."
            ) from error
        logger.exception("Failed to create a study goal")
        raise _database_error("create the study goal") from error


@router.patch("/goals/{goal_id}")
def update_study_goal(goal_id: UUID, goal: StudyGoalUpdate, user: CurrentUser) -> dict:
    changes = goal.model_dump(exclude_unset=True)
    changes = {
        key: value for key, value in changes.items() if value is not None or key == "target_date"
    }
    if not changes:
        raise HTTPException(status_code=400, detail="Choose at least one field to update.")
    columns = {
        "subject": "subject",
        "target_sessions": "target_sessions",
        "target_date": "target_date",
    }
    assignments = ", ".join(f"{columns[key]}=%s" for key in changes)
    try:
        with database_connection(user.id) as connection:
            row = connection.execute(
                f"update study_goals set {assignments} where id=%s and user_id=%s "
                "returning id,subject,target_sessions,target_date,created_at,updated_at",
                (*changes.values(), goal_id, UUID(user.id)),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Study goal not found.")
        return row
    except DatabaseError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=409, detail="A goal for this subject already exists."
            ) from error
        logger.exception("Failed to update a study goal")
        raise _database_error("update the study goal") from error


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study_goal(goal_id: UUID, user: CurrentUser) -> None:
    try:
        with database_connection(user.id) as connection:
            deleted = connection.execute(
                "delete from study_goals where id=%s and user_id=%s returning id",
                (goal_id, UUID(user.id)),
            ).fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Study goal not found.")
    except DatabaseError as error:
        logger.exception("Failed to delete a study goal")
        raise _database_error("delete the study goal") from error


@router.post("/goals/{goal_id}/topics", status_code=status.HTTP_201_CREATED)
def add_study_goal_topic(
    goal_id: UUID,
    topic: StudyGoalTopicCreate,
    user: CurrentUser,
) -> dict:
    try:
        with database_connection(user.id) as connection:
            owned_goal = connection.execute(
                "select 1 from study_goals where id=%s and user_id=%s",
                (goal_id, UUID(user.id)),
            ).fetchone()
            if not owned_goal:
                raise HTTPException(status_code=404, detail="Study goal not found.")
            row = connection.execute(
                """insert into study_goal_topics(goal_id,topic) values (%s,%s)
                   returning id,goal_id,topic,completed,completed_at,created_at""",
                (goal_id, topic.topic),
            ).fetchone()
        return row
    except DatabaseError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=409, detail="This topic is already on the goal."
            ) from error
        logger.exception("Failed to add a topic to the study goal")
        raise _database_error("add this study topic") from error


@router.patch("/goals/{goal_id}/topics/{topic_id}")
def update_study_goal_topic(
    goal_id: UUID,
    topic_id: UUID,
    topic: StudyGoalTopicUpdate,
    user: CurrentUser,
) -> dict:
    try:
        with database_connection(user.id) as connection:
            row = connection.execute(
                """update study_goal_topics t set completed=%s,
                     completed_at=case when %s then now() else null end
                   from study_goals g
                   where t.id=%s and t.goal_id=%s and g.id=t.goal_id and g.user_id=%s
                   returning t.id,t.goal_id,t.topic,t.completed,t.completed_at,t.created_at""",
                (topic.completed, topic.completed, topic_id, goal_id, UUID(user.id)),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Study topic not found.")
        return row
    except DatabaseError as error:
        logger.exception("Failed to update a study topic")
        raise _database_error("update the study topic") from error


@router.delete(
    "/goals/{goal_id}/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_study_goal_topic(goal_id: UUID, topic_id: UUID, user: CurrentUser) -> None:
    try:
        with database_connection(user.id) as connection:
            row = connection.execute(
                """delete from study_goal_topics t using study_goals g
                   where t.id=%s and t.goal_id=%s and g.id=t.goal_id and g.user_id=%s
                   returning t.id""",
                (topic_id, goal_id, UUID(user.id)),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Study topic not found.")
    except DatabaseError as error:
        logger.exception("Failed to delete a study topic")
        raise _database_error("delete the study topic") from error


@router.get("/progress")
def get_weekly_progress(user: CurrentUser) -> dict:
    try:
        with database_connection(user.id) as connection:
            summary = connection.execute(
                """select date_trunc('week',now()) as week_starts_at,
                          count(distinct s.id) as completed_sessions,
                          coalesce(sum(s.duration_minutes),0) as study_minutes
                   from study_sessions s join session_participants sp on sp.session_id=s.id
                   where sp.student_id=%s and sp.status='accepted' and s.status='completed'
                     and s.starts_at>=date_trunc('week',now())""",
                (UUID(user.id),),
            ).fetchone()
            by_subject = connection.execute(
                """select s.subject,count(distinct s.id) as completed_sessions,
                          coalesce(sum(s.duration_minutes),0) as study_minutes
                   from study_sessions s join session_participants sp on sp.session_id=s.id
                   where sp.student_id=%s and sp.status='accepted' and s.status='completed'
                     and s.starts_at>=date_trunc('week',now())
                   group by s.subject order by completed_sessions desc,s.subject""",
                (UUID(user.id),),
            ).fetchall()
        return {"summary": summary, "subjects": by_subject}
    except DatabaseError as error:
        logger.exception("Failed to load weekly progress")
        raise _database_error("load weekly progress") from error


@router.get("/safety/blocks")
def list_blocked_users(user: CurrentUser) -> list[dict]:
    try:
        with database_connection(user.id) as connection:
            return connection.execute(
                """select b.blocked_id as student_id,p.full_name,p.major,b.created_at
                   from blocked_users b join profiles p on p.id=b.blocked_id
                   where b.blocker_id=%s order by b.created_at desc""",
                (UUID(user.id),),
            ).fetchall()
    except DatabaseError as error:
        logger.exception("Failed to list blocked users")
        raise _database_error("load blocked users") from error


@router.post("/safety/blocks", status_code=status.HTTP_201_CREATED)
def block_user(block: UserBlockCreate, user: CurrentUser) -> dict[str, str]:
    user_id = UUID(user.id)
    if block.student_id == user_id:
        raise HTTPException(status_code=422, detail="You cannot block your own account.")
    try:
        with database_connection(user.id) as connection:
            target = connection.execute(
                "select id from profiles where id=%s",
                (block.student_id,),
            ).fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="Student profile not found.")
            connection.execute(
                "insert into blocked_users(blocker_id,blocked_id) values (%s,%s) "
                "on conflict do nothing",
                (user_id, block.student_id),
            )
        return {"student_id": str(block.student_id)}
    except DatabaseError as error:
        logger.exception("Failed to block a user")
        raise _database_error("block this student") from error


@router.delete("/safety/blocks/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def unblock_user(student_id: UUID, user: CurrentUser) -> None:
    try:
        with database_connection(user.id) as connection:
            connection.execute(
                "delete from blocked_users where blocker_id=%s and blocked_id=%s",
                (UUID(user.id), student_id),
            )
    except DatabaseError as error:
        logger.exception("Failed to unblock a user")
        raise _database_error("unblock this student") from error


@router.post("/safety/reports", status_code=status.HTTP_201_CREATED)
def create_safety_report(report: SafetyReportCreate, user: CurrentUser) -> dict[str, str]:
    user_id = UUID(user.id)
    try:
        with database_connection(user.id) as connection:
            if report.entity_type == "profile":
                reported_user = report.entity_id
                exists = connection.execute(
                    "select 1 from profiles where id=%s and id<>%s",
                    (reported_user, user_id),
                ).fetchone()
            else:
                message = connection.execute(
                    """select m.author_id from messages m
                       join conversation_members cm on cm.conversation_id=m.conversation_id
                       where m.id=%s and cm.student_id=%s""",
                    (report.entity_id, user_id),
                ).fetchone()
                reported_user = message["author_id"] if message else None
                exists = message and reported_user != user_id
            if not exists or not reported_user:
                raise HTTPException(
                    status_code=404,
                    detail="The profile or message was not found, or it cannot be reported.",
                )
            row = connection.execute(
                """insert into safety_reports
                   (reporter_id,reported_user_id,entity_type,entity_id,reason,details)
                   values (%s,%s,%s,%s,%s,%s) returning id""",
                (
                    user_id,
                    reported_user,
                    report.entity_type,
                    report.entity_id,
                    report.reason,
                    report.details,
                ),
            ).fetchone()
        return {"id": str(row["id"])}
    except DatabaseError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=409, detail="This profile or message has already been reported."
            ) from error
        logger.exception("Failed to submit a safety report")
        raise _database_error("send this report") from error
