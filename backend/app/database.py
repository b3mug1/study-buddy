import logging
from collections.abc import Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

logger = logging.getLogger(__name__)
_pool: ConnectionPool | None = None

TABLE_COLUMNS: dict[str, set[str]] = {
    "profiles": {
        "id",
        "full_name",
        "university_name",
        "major",
        "year_of_study",
        "bio",
        "avatar_url",
        "is_onboarded",
        "show_in_discovery",
        "created_at",
        "updated_at",
    },
    "subjects": {"id", "name", "created_at"},
    "student_subjects": {"student_id", "subject_id", "created_at"},
    "student_availability": {
        "student_id",
        "weekday",
        "start_time",
        "end_time",
        "created_at",
    },
    "study_preferences": {
        "student_id",
        "learning_goals",
        "study_format",
        "group_size",
        "language",
        "preferred_hours",
        "created_at",
        "updated_at",
    },
    "connections": {
        "id",
        "requester_id",
        "addressee_id",
        "status",
        "created_at",
        "updated_at",
    },
    "study_groups": {
        "id",
        "owner_id",
        "name",
        "description",
        "subject",
        "visibility",
        "max_members",
        "created_at",
        "updated_at",
    },
    "group_members": {"group_id", "student_id", "role", "joined_at"},
    "group_join_requests": {
        "id",
        "group_id",
        "student_id",
        "status",
        "created_at",
        "updated_at",
    },
    "conversations": {
        "id",
        "kind",
        "connection_id",
        "group_id",
        "created_by",
        "created_at",
    },
    "conversation_members": {"conversation_id", "student_id", "joined_at"},
    "messages": {"id", "conversation_id", "author_id", "body", "created_at"},
    "notifications": {
        "id",
        "user_id",
        "kind",
        "title",
        "body",
        "entity_type",
        "entity_id",
        "read_at",
        "created_at",
    },
    "study_sessions": {
        "id",
        "owner_id",
        "subject",
        "topic",
        "starts_at",
        "duration_minutes",
        "study_format",
        "meeting_details",
        "max_participants",
        "status",
        "created_at",
        "updated_at",
    },
    "session_participants": {
        "session_id",
        "student_id",
        "status",
        "responded_at",
        "created_at",
    },
}


class DatabaseError(Exception):
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class QueryResult:
    data: Any
    count: int | None = None


def configure_database() -> None:
    global _pool
    settings = get_settings()
    if not settings.database_url:
        return
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        _pool.open(wait=False)


def close_database() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        configure_database()
    if _pool is None:
        raise DatabaseError("PostgreSQL is not configured. Set DATABASE_URL in backend/.env.local.")
    return _pool


@contextmanager
def database_connection(user_id: str | None = None):
    try:
        with get_pool().connection() as connection:
            with connection.transaction():
                connection.execute(
                    "select set_config('app.user_id', %s, true)",
                    (user_id or "",),
                )
                yield connection
    except psycopg.Error as error:
        logger.exception("PostgreSQL operation failed")
        sqlstate = getattr(error, "sqlstate", None)
        message = (
            error.diag.message_primary
            if sqlstate == "P0001" and error.diag
            else "The database operation could not be completed."
        )
        raise DatabaseError(
            message,
            sqlstate,
        ) from error


def _to_api_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    return value


def _row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _to_api_value(value) for key, value in row.items()}


def _policy(table: str, operation: str, user_id: str) -> tuple[str, list[Any]]:
    if operation == "insert":
        return _insert_policy(table, user_id)
    if table == "profiles":
        return (
            """(
                id = %s
                or (is_onboarded and show_in_discovery)
                or exists (
                    select 1 from connections c
                    where c.status = 'accepted'
                      and ((c.requester_id = profiles.id and c.addressee_id = %s)
                        or (c.addressee_id = profiles.id and c.requester_id = %s))
                )
                or exists (
                    select 1 from group_members mine
                    join group_members theirs on theirs.group_id = mine.group_id
                    where mine.student_id = %s and theirs.student_id = profiles.id
                )
            )""",
            [user_id] * 4,
        )
    if table in {"subjects"}:
        return "true", []
    if table in {"student_subjects", "student_availability", "study_preferences"}:
        owner = "student_id"
        return (
            f"""(
                {owner} = %s
                or exists (
                    select 1 from profiles p
                    where p.id = {table}.{owner}
                      and p.is_onboarded and p.show_in_discovery
                )
                or exists (
                    select 1 from connections c
                    where c.status = 'accepted'
                      and ((c.requester_id = {table}.{owner} and c.addressee_id = %s)
                        or (c.addressee_id = {table}.{owner} and c.requester_id = %s))
                )
            )""",
            [user_id, user_id, user_id],
        )
    if table == "connections":
        return "requester_id = %s or addressee_id = %s", [user_id, user_id]
    if table == "study_groups":
        return (
            """visibility = 'public' or owner_id = %s
               or exists (select 1 from group_members gm
                          where gm.group_id = study_groups.id and gm.student_id = %s)""",
            [user_id, user_id],
        )
    if table == "group_members":
        return (
            """student_id = %s
               or exists (
                 select 1 from study_groups g
                 where g.id = group_members.group_id
                   and (g.visibility = 'public' or g.owner_id = %s)
               )
               or exists (
                 select 1 from group_members mine
                 where mine.group_id = group_members.group_id and mine.student_id = %s
               )""",
            [user_id, user_id, user_id],
        )
    if table == "group_join_requests":
        return (
            """student_id = %s or exists (
                 select 1 from study_groups g
                 where g.id = group_join_requests.group_id and g.owner_id = %s
               )""",
            [user_id, user_id],
        )
    if table == "conversations":
        return (
            "exists (select 1 from conversation_members cm "
            "where cm.conversation_id = conversations.id and cm.student_id = %s)",
            [user_id],
        )
    if table == "conversation_members":
        return (
            "student_id = %s or exists (select 1 from conversation_members mine "
            "where mine.conversation_id = conversation_members.conversation_id "
            "and mine.student_id = %s)",
            [user_id, user_id],
        )
    if table == "messages":
        membership = (
            "exists (select 1 from conversation_members cm "
            "where cm.conversation_id = messages.conversation_id and cm.student_id = %s)"
        )
        if operation == "delete":
            return f"author_id = %s and {membership}", [user_id, user_id]
        return membership, [user_id]
    if table == "notifications":
        return "user_id = %s", [user_id]
    if table == "study_sessions":
        return (
            "owner_id = %s or exists (select 1 from session_participants sp "
            "where sp.session_id = study_sessions.id and sp.student_id = %s)",
            [user_id, user_id],
        )
    if table == "session_participants":
        return (
            "student_id = %s or exists (select 1 from study_sessions s "
            "where s.id = session_participants.session_id and s.owner_id = %s)",
            [user_id, user_id],
        )
    raise DatabaseError("Access to this database table is not configured.")


def _insert_policy(table: str, user_id: str) -> tuple[str, list[Any]]:
    if table == "messages":
        return (
            """author_id = %s and exists (
                select 1 from conversation_members cm
                where cm.conversation_id = messages.conversation_id
                  and cm.student_id = %s
            )""",
            [user_id, user_id],
        )
    raise DatabaseError("Direct inserts are not permitted for this table.")


class PostgresDatabase:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def table(self, name: str) -> "TableQuery":
        if name not in TABLE_COLUMNS:
            raise DatabaseError("Unknown database table.")
        return TableQuery(self, name)

    def rpc(self, name: str, params: dict[str, Any]) -> "RpcQuery":
        return RpcQuery(self, name, params)


class TableQuery:
    def __init__(self, database: PostgresDatabase, table: str):
        self.database = database
        self.table_name = table
        self.columns: list[str] = ["*"]
        self.filters: list[tuple[str, str, Any]] = []
        self.order_by: list[tuple[str, bool]] = []
        self.limit_value: int | None = None
        self.offset_value = 0
        self.action = "select"
        self.values: dict[str, Any] = {}
        self.count_exact = False
        self.return_single = False
        self.allow_empty_single = False

    def select(self, columns: str = "*", count: str | None = None) -> "TableQuery":
        self.columns = self._validate_columns(columns)
        self.count_exact = count == "exact"
        if self.action in {"insert", "update", "delete"}:
            self.action = f"{self.action}_returning"
        return self

    def eq(self, column: str, value: Any) -> "TableQuery":
        return self._filter(column, "=", value)

    def neq(self, column: str, value: Any) -> "TableQuery":
        return self._filter(column, "<>", value)

    def ilike(self, column: str, value: Any) -> "TableQuery":
        return self._filter(column, "ilike", value)

    def gte(self, column: str, value: Any) -> "TableQuery":
        return self._filter(column, ">=", value)

    def lt(self, column: str, value: Any) -> "TableQuery":
        return self._filter(column, "<", value)

    def in_(self, column: str, values: Sequence[Any]) -> "TableQuery":
        if column not in TABLE_COLUMNS[self.table_name]:
            raise DatabaseError("Invalid database column.")
        self.filters.append((column, "in", list(values)))
        return self

    def is_(self, column: str, value: str) -> "TableQuery":
        if value != "null":
            raise DatabaseError("Only IS NULL filters are supported.")
        if column not in TABLE_COLUMNS[self.table_name]:
            raise DatabaseError("Invalid database column.")
        self.filters.append((column, "is null", None))
        return self

    def order(self, column: str, desc: bool = False) -> "TableQuery":
        if column not in TABLE_COLUMNS[self.table_name]:
            raise DatabaseError("Invalid database column.")
        self.order_by.append((column, desc))
        return self

    def limit(self, value: int) -> "TableQuery":
        self.limit_value = max(0, min(int(value), 1000))
        return self

    def range(self, start: int, end: int) -> "TableQuery":
        self.offset_value = max(0, int(start))
        self.limit_value = max(0, min(int(end) - int(start) + 1, 1000))
        return self

    def maybe_single(self) -> "TableQuery":
        self.return_single = True
        self.allow_empty_single = True
        return self

    def single(self) -> "TableQuery":
        self.return_single = True
        return self

    def insert(self, values: dict[str, Any] | list[dict[str, Any]]) -> "TableQuery":
        if isinstance(values, list):
            if len(values) != 1:
                raise DatabaseError("Batch inserts are not supported by this operation.")
            values = values[0]
        self.action = "insert"
        self.values = self._validate_values(values)
        return self

    def update(self, values: dict[str, Any]) -> "TableQuery":
        self.action = "update"
        self.values = self._validate_values(values)
        return self

    def delete(self) -> "TableQuery":
        self.action = "delete"
        return self

    def execute(self) -> QueryResult:
        action = self.action.removesuffix("_returning")
        where_sql, where_params = self._where_clause()
        table = self.table_name
        with database_connection(self.database.user_id) as connection:
            if action == "select":
                count = None
                if self.count_exact:
                    count_row = connection.execute(
                        f"select count(*) as count from {table} where {where_sql}",
                        where_params,
                    ).fetchone()
                    count = count_row["count"]
                if self.limit_value == 0:
                    return QueryResult([], count)
                columns = ", ".join(self.columns)
                order = self._order_clause()
                limit = ""
                params = list(where_params)
                if self.limit_value is not None:
                    limit = " limit %s"
                    params.append(self.limit_value)
                if self.offset_value:
                    limit += " offset %s"
                    params.append(self.offset_value)
                rows = connection.execute(
                    f"select {columns} from {table} where {where_sql}{order}{limit}",
                    params,
                ).fetchall()
                return QueryResult(self._shape(rows), count)

            if action in {"insert", "update"}:
                if action == "insert":
                    self._validate_insert_access()
                    columns = list(self.values)
                    names = ", ".join(columns)
                    policy, policy_params = _policy(table, "insert", self.database.user_id)
                    returning = self._returning_clause()
                    row = connection.execute(
                        f"""insert into {table} ({names})
                            select {", ".join(["%s"] * len(columns))}
                            where {policy}
                            {returning}""",
                        [*self.values.values(), *policy_params],
                    ).fetchall()
                else:
                    if table == "profiles" and "id" not in {
                        column for column, _, _ in self.filters
                    }:
                        raise DatabaseError("Profile updates must target one user.")
                    if table == "study_groups" and "owner_id" not in {
                        column for column, _, _ in self.filters
                    }:
                        raise DatabaseError("Study group updates must target an owner.")
                    assignments = ", ".join(f"{column} = %s" for column in self.values)
                    returning = self._returning_clause()
                    row = connection.execute(
                        f"update {table} set {assignments} where {where_sql}{returning}",
                        [*self.values.values(), *where_params],
                    ).fetchall()
                return QueryResult(self._shape(row))

            if action == "delete":
                if table in {"messages"} and "author_id" not in {
                    column for column, _, _ in self.filters
                }:
                    raise DatabaseError("Message deletes must target the author.")
                returning = self._returning_clause()
                rows = connection.execute(
                    f"delete from {table} where {where_sql}{returning}",
                    where_params,
                ).fetchall()
                return QueryResult(self._shape(rows))

        raise DatabaseError("Unsupported database operation.")

    def _filter(self, column: str, operator: str, value: Any) -> "TableQuery":
        if column not in TABLE_COLUMNS[self.table_name]:
            raise DatabaseError("Invalid database column.")
        self.filters.append((column, operator, value))
        return self

    def _validate_columns(self, value: str) -> list[str]:
        if value.strip() == "*":
            return ["*"]
        columns = [column.strip() for column in value.split(",")]
        if any(column not in TABLE_COLUMNS[self.table_name] for column in columns):
            raise DatabaseError("Invalid database column.")
        return columns

    def _validate_values(self, values: dict[str, Any]) -> dict[str, Any]:
        if not values or any(key not in TABLE_COLUMNS[self.table_name] for key in values):
            raise DatabaseError("Invalid database columns in write.")
        return values

    def _where_clause(self) -> tuple[str, list[Any]]:
        policy, params = _policy(
            self.table_name,
            "delete" if self.action == "delete" else "select",
            self.database.user_id,
        )
        parts = [f"({policy})"]
        values = list(params)
        for column, operator, value in self.filters:
            if operator == "is null":
                parts.append(f"{column} is null")
            elif operator == "in":
                if not value:
                    parts.append("false")
                else:
                    parts.append(f"{column} in ({', '.join(['%s'] * len(value))})")
                    values.extend(value)
            elif operator == "ilike":
                parts.append(f"{column} ilike %s")
                values.append(value)
            else:
                parts.append(f"{column} {operator} %s")
                values.append(value)
        return " and ".join(parts), values

    def _order_clause(self) -> str:
        if not self.order_by:
            return ""
        return " order by " + ", ".join(
            f"{column} {'desc' if desc else 'asc'}" for column, desc in self.order_by
        )

    def _returning_clause(self) -> str:
        if self.action.endswith("_returning"):
            return f" returning {', '.join(self.columns)}"
        if self.return_single or self.columns != ["*"]:
            return f" returning {', '.join(self.columns)}"
        return " returning *"

    def _shape(self, rows: list[dict[str, Any]]) -> Any:
        result = [_row_to_api(row) for row in rows]
        if self.return_single:
            if len(result) > 1:
                raise DatabaseError("Expected one database row.")
            if not result and not self.allow_empty_single:
                raise DatabaseError("Database row was not found.")
            return result[0] if result else None
        return result

    def _validate_insert_access(self) -> None:
        if self.action == "insert":
            allowed, _ = _insert_policy(self.table_name, self.database.user_id)
            if not allowed:
                raise DatabaseError("Insert is not permitted.")


class RpcQuery:
    def __init__(
        self,
        database: PostgresDatabase,
        name: str,
        params: dict[str, Any],
    ):
        self.database = database
        self.name = name
        self.params = params

    def execute(self) -> QueryResult:
        dispatch = {
            "complete_onboarding": self._complete_onboarding,
            "create_connection_request": self._create_connection_request,
            "respond_to_connection": self._respond_to_connection,
            "create_study_group": self._create_study_group,
            "request_group_join": self._request_group_join,
            "respond_to_group_join_request": self._respond_to_group_join_request,
            "remove_group_member": self._remove_group_member,
            "create_study_session": self._create_study_session,
            "respond_to_session_invitation": self._respond_to_session_invitation,
            "ensure_upcoming_session_notifications": self._ensure_upcoming_session_notifications,
            "recent_conversation_messages": self._recent_conversation_messages,
        }
        operation = dispatch.get(self.name)
        if operation is None:
            raise DatabaseError("Unknown database operation.")
        return QueryResult(operation())

    @contextmanager
    def _transaction(self):
        with database_connection(self.database.user_id) as connection:
            yield connection

    def _complete_onboarding(self) -> None:
        p = self.params
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            connection.execute(
                """insert into profiles (
                    id, full_name, university_name, major, year_of_study, bio,
                    is_onboarded, show_in_discovery
                ) values (%s,%s,%s,%s,%s,%s,true,%s)
                on conflict (id) do update set
                    full_name=excluded.full_name,
                    university_name=excluded.university_name,
                    major=excluded.major,
                    year_of_study=excluded.year_of_study,
                    bio=excluded.bio,
                    is_onboarded=true,
                    show_in_discovery=excluded.show_in_discovery,
                    updated_at=now()""",
                (
                    user_id,
                    p["p_full_name"],
                    p["p_university_name"],
                    p["p_major"],
                    p["p_year_of_study"],
                    p["p_bio"],
                    p["p_show_in_discovery"],
                ),
            )
            subject_ids = []
            for name in p["p_subjects"]:
                row = connection.execute(
                    """insert into subjects(name) values (%s)
                       on conflict (name) do update set name=excluded.name
                       returning id""",
                    (name.strip().title(),),
                ).fetchone()
                subject_ids.append(row["id"])
            connection.execute("delete from student_subjects where student_id=%s", (user_id,))
            for subject_id in subject_ids:
                connection.execute(
                    "insert into student_subjects(student_id,subject_id) values (%s,%s)",
                    (user_id, subject_id),
                )
            connection.execute(
                "delete from student_availability where student_id=%s",
                (user_id,),
            )
            for weekday in set(p["p_availability_days"]):
                connection.execute(
                    """insert into student_availability
                       (student_id,weekday,start_time,end_time) values (%s,%s,%s,%s)""",
                    (user_id, weekday, p["p_start_time"], p["p_end_time"]),
                )
            connection.execute(
                """insert into study_preferences
                   (student_id,learning_goals,study_format,group_size,language,preferred_hours)
                   values (%s,%s,%s,%s,%s,%s)
                   on conflict (student_id) do update set
                     learning_goals=excluded.learning_goals,
                     study_format=excluded.study_format,
                     group_size=excluded.group_size,
                     language=excluded.language,
                     preferred_hours=excluded.preferred_hours,
                     updated_at=now()""",
                (
                    user_id,
                    p["p_learning_goals"],
                    p["p_study_format"],
                    p["p_group_size"],
                    p["p_language"],
                    p["p_preferred_hours"],
                ),
            )

    def _create_connection_request(self) -> str:
        requester = UUID(self.database.user_id)
        addressee = UUID(self.params["p_addressee_id"])
        with self._transaction() as connection:
            connection.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s,0))",
                (":".join(sorted((str(requester), str(addressee)))),),
            )
            candidate = connection.execute(
                """select id,status from connections
                   where least(requester_id,addressee_id)=least(%s,%s)
                     and greatest(requester_id,addressee_id)=greatest(%s,%s)
                   for update""",
                (requester, addressee, requester, addressee),
            ).fetchone()
            visible = connection.execute(
                "select 1 from profiles where id=%s and is_onboarded and show_in_discovery",
                (addressee,),
            ).fetchone()
            if not visible:
                raise DatabaseError("This student is not available for discovery.", "P0001")
            if candidate and candidate["status"] == "accepted":
                raise DatabaseError("You are already connected.", "P0001")
            if candidate and candidate["status"] == "pending":
                raise DatabaseError("A connection request is already pending.", "P0001")
            if candidate:
                connection.execute(
                    """update connections set requester_id=%s,addressee_id=%s,
                       status='pending',created_at=now(),updated_at=now() where id=%s""",
                    (requester, addressee, candidate["id"]),
                )
                connection_id = candidate["id"]
            else:
                connection_id = connection.execute(
                    """insert into connections(requester_id,addressee_id)
                       values (%s,%s) returning id""",
                    (requester, addressee),
                ).fetchone()["id"]
            self._notification(
                connection,
                addressee,
                "connection_request",
                "New study partner request",
                "A student would like to connect with you.",
                "connection",
                connection_id,
            )
            return str(connection_id)

    def _respond_to_connection(self) -> None:
        connection_id = UUID(self.params["p_connection_id"])
        accept = self.params["p_accept"]
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            row = connection.execute(
                """select id,requester_id,addressee_id from connections
                   where id=%s and addressee_id=%s and status='pending' for update""",
                (connection_id, user_id),
            ).fetchone()
            if not row:
                raise DatabaseError("Connection request not found or already answered.", "P0001")
            connection.execute(
                "update connections set status=%s,updated_at=now() where id=%s",
                ("accepted" if accept else "declined", connection_id),
            )
            if accept:
                conversation_id = connection.execute(
                    """insert into conversations(kind,connection_id,created_by)
                       values ('direct',%s,%s) returning id""",
                    (connection_id, row["requester_id"]),
                ).fetchone()["id"]
                for student_id in (row["requester_id"], row["addressee_id"]):
                    connection.execute(
                        """insert into conversation_members(conversation_id,student_id)
                           values (%s,%s) on conflict do nothing""",
                        (conversation_id, student_id),
                    )
                self._notification(
                    connection,
                    row["requester_id"],
                    "connection_accepted",
                    "Study partner request accepted",
                    "Your connection request was accepted.",
                    "connection",
                    connection_id,
                )

    def _create_study_group(self) -> str:
        p = self.params
        owner = UUID(self.database.user_id)
        with self._transaction() as connection:
            group_id = connection.execute(
                """insert into study_groups
                   (owner_id,name,description,subject,visibility,max_members)
                   values (%s,%s,%s,%s,%s,%s) returning id""",
                (
                    owner,
                    p["p_name"],
                    p["p_description"],
                    p["p_subject"],
                    p["p_visibility"],
                    p["p_max_members"],
                ),
            ).fetchone()["id"]
            conversation_id = connection.execute(
                """insert into conversations(kind,group_id,created_by)
                   values ('group',%s,%s) returning id""",
                (group_id, owner),
            ).fetchone()["id"]
            connection.execute(
                "insert into group_members(group_id,student_id,role) values (%s,%s,'owner')",
                (group_id, owner),
            )
            connection.execute(
                "insert into conversation_members(conversation_id,student_id) values (%s,%s)",
                (conversation_id, owner),
            )
        return str(group_id)

    def _request_group_join(self) -> str:
        group_id = UUID(self.params["p_group_id"])
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            group = connection.execute(
                "select * from study_groups where id=%s for update", (group_id,)
            ).fetchone()
            if not group:
                raise DatabaseError("Study group not found.", "P0001")
            if connection.execute(
                "select 1 from group_members where group_id=%s and student_id=%s",
                (group_id, user_id),
            ).fetchone():
                raise DatabaseError("You are already a member of this group.", "P0001")
            count = connection.execute(
                "select count(*) as count from group_members where group_id=%s",
                (group_id,),
            ).fetchone()["count"]
            if count >= group["max_members"]:
                raise DatabaseError("This study group is full.", "P0001")
            if group["visibility"] == "public":
                self._add_group_member(connection, group_id, user_id, "member")
                return "joined"
            request = connection.execute(
                """select id,status from group_join_requests
                   where group_id=%s and student_id=%s for update""",
                (group_id, user_id),
            ).fetchone()
            if request and request["status"] == "pending":
                raise DatabaseError("A join request is already pending.", "P0001")
            if request:
                connection.execute(
                    """update group_join_requests set status='pending',created_at=now(),
                       updated_at=now() where id=%s""",
                    (request["id"],),
                )
                request_id = request["id"]
            else:
                request_id = connection.execute(
                    """insert into group_join_requests(group_id,student_id)
                       values (%s,%s) returning id""",
                    (group_id, user_id),
                ).fetchone()["id"]
            self._notification(
                connection,
                group["owner_id"],
                "group_join_request",
                "New group join request",
                "A student requested to join your group.",
                "group_join_request",
                request_id,
            )
            return "requested"

    def _respond_to_group_join_request(self) -> None:
        request_id = UUID(self.params["p_request_id"])
        approve = self.params["p_approve"]
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            request = connection.execute(
                "select * from group_join_requests where id=%s and status='pending' for update",
                (request_id,),
            ).fetchone()
            if not request:
                raise DatabaseError("Join request not found or already answered.", "P0001")
            group = connection.execute(
                "select * from study_groups where id=%s for update",
                (request["group_id"],),
            ).fetchone()
            if not group or group["owner_id"] != user_id:
                raise DatabaseError("Only the group owner can respond to join requests.", "P0001")
            if approve:
                count = connection.execute(
                    "select count(*) as count from group_members where group_id=%s",
                    (group["id"],),
                ).fetchone()["count"]
                if count >= group["max_members"]:
                    raise DatabaseError("This study group is full.", "P0001")
                self._add_group_member(connection, group["id"], request["student_id"], "member")
            connection.execute(
                "update group_join_requests set status=%s,updated_at=now() where id=%s",
                ("approved" if approve else "declined", request_id),
            )
            if approve:
                self._notification(
                    connection,
                    request["student_id"],
                    "group_join_approved",
                    "You joined a study group",
                    f"Your request to join {group['name']} was approved.",
                    "study_group",
                    group["id"],
                )

    def _remove_group_member(self) -> None:
        group_id = UUID(self.params["p_group_id"])
        student_id = UUID(self.params["p_student_id"])
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            group = connection.execute(
                "select owner_id from study_groups where id=%s for update",
                (group_id,),
            ).fetchone()
            if not group:
                raise DatabaseError("Study group not found.", "P0001")
            if student_id != user_id and group["owner_id"] != user_id:
                raise DatabaseError("Only the group owner can remove other members.", "P0001")
            if student_id == group["owner_id"]:
                raise DatabaseError("The group owner cannot leave or be removed.", "P0001")
            removed = connection.execute(
                """delete from group_members
                   where group_id=%s and student_id=%s returning student_id""",
                (group_id, student_id),
            ).fetchone()
            if not removed:
                raise DatabaseError("Group member not found.", "P0001")
            conversation = connection.execute(
                "select id from conversations where group_id=%s", (group_id,)
            ).fetchone()
            if conversation:
                connection.execute(
                    "delete from conversation_members where conversation_id=%s and student_id=%s",
                    (conversation["id"], student_id),
                )

    def _create_study_session(self) -> str:
        p = self.params
        owner_id = UUID(self.database.user_id)
        invitees = [UUID(value) for value in p["p_invited_user_ids"]]
        with self._transaction() as connection:
            if len(set(invitees)) != len(invitees) or owner_id in invitees:
                raise DatabaseError(
                    "Invitees must be unique and cannot include the organizer.",
                    "P0001",
                )
            connected = {
                row["student_id"]
                for row in connection.execute(
                    """select case when requester_id=%s then addressee_id else requester_id end
                       as student_id from connections where status='accepted'
                       and (requester_id=%s or addressee_id=%s)""",
                    (owner_id, owner_id, owner_id),
                ).fetchall()
            }
            if not set(invitees).issubset(connected):
                raise DatabaseError("Study session invitees must be connected students.", "P0001")
            session_id = connection.execute(
                """insert into study_sessions
                   (owner_id,subject,topic,starts_at,duration_minutes,study_format,
                    meeting_details,max_participants)
                   values (%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
                (
                    owner_id,
                    p["p_subject"],
                    p["p_topic"],
                    p["p_starts_at"],
                    p["p_duration_minutes"],
                    p["p_study_format"],
                    p["p_meeting_details"],
                    p["p_max_participants"],
                ),
            ).fetchone()["id"]
            connection.execute(
                """insert into session_participants(session_id,student_id,status)
                   values (%s,%s,'accepted')""",
                (session_id, owner_id),
            )
            for invitee in invitees:
                connection.execute(
                    """insert into session_participants(session_id,student_id,status)
                       values (%s,%s,'invited')""",
                    (session_id, invitee),
                )
                self._notification(
                    connection,
                    invitee,
                    "session_invitation",
                    "Study session invitation",
                    f"You were invited to study {p['p_subject']}.",
                    "study_session",
                    session_id,
                )
        return str(session_id)

    def _respond_to_session_invitation(self) -> None:
        session_id = UUID(self.params["p_session_id"])
        user_id = UUID(self.database.user_id)
        accept = self.params["p_accept"]
        with self._transaction() as connection:
            session = connection.execute(
                "select * from study_sessions where id=%s for update", (session_id,)
            ).fetchone()
            if not session or session["status"] != "scheduled":
                raise DatabaseError("Study session not found or cancelled.", "P0001")
            invitation = connection.execute(
                """select status from session_participants
                   where session_id=%s and student_id=%s for update""",
                (session_id, user_id),
            ).fetchone()
            if not invitation or invitation["status"] != "invited":
                raise DatabaseError(
                    "Study session invitation not found or already answered.",
                    "P0001",
                )
            if accept:
                count = connection.execute(
                    """select count(*) as count from session_participants
                       where session_id=%s and status='accepted'""",
                    (session_id,),
                ).fetchone()["count"]
                if count >= session["max_participants"]:
                    raise DatabaseError("This study session is full.", "P0001")
            new_status = "accepted" if accept else "declined"
            connection.execute(
                """update session_participants set status=%s,responded_at=now()
                   where session_id=%s and student_id=%s""",
                (new_status, session_id, user_id),
            )
            full_name = connection.execute(
                "select full_name from profiles where id=%s", (user_id,)
            ).fetchone()["full_name"]
            self._notification(
                connection,
                session["owner_id"],
                "session_response",
                "Study session invitation updated",
                f"{full_name} {'accepted' if accept else 'declined'} your invitation.",
                "study_session",
                session_id,
            )

    def _ensure_upcoming_session_notifications(self) -> None:
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            rows = connection.execute(
                """select s.id,s.subject,s.topic from study_sessions s
                   join session_participants sp on sp.session_id=s.id
                   where sp.student_id=%s and sp.status='accepted'
                     and s.status='scheduled' and s.starts_at>now()
                     and s.starts_at<=now()+interval '24 hours'""",
                (user_id,),
            ).fetchall()
            for row in rows:
                self._notification(
                    connection,
                    user_id,
                    "session_upcoming",
                    "Study session coming up",
                    f"{row['subject']}: {row['topic']} starts within 24 hours.",
                    "study_session",
                    row["id"],
                )

    def _recent_conversation_messages(self) -> list[dict[str, Any]]:
        user_id = UUID(self.database.user_id)
        with self._transaction() as connection:
            rows = connection.execute(
                """select distinct on (m.conversation_id)
                     m.conversation_id,m.body,m.created_at
                   from messages m join conversation_members cm
                     on cm.conversation_id=m.conversation_id
                   where cm.student_id=%s
                   order by m.conversation_id,m.created_at desc,m.id desc""",
                (user_id,),
            ).fetchall()
            return [_row_to_api(row) for row in rows]

    @staticmethod
    def _add_group_member(connection: Any, group_id: UUID, student_id: UUID, role: str) -> None:
        connection.execute(
            """insert into group_members(group_id,student_id,role)
               values (%s,%s,%s) on conflict do nothing""",
            (group_id, student_id, role),
        )
        conversation = connection.execute(
            "select id from conversations where group_id=%s", (group_id,)
        ).fetchone()
        if conversation:
            connection.execute(
                """insert into conversation_members(conversation_id,student_id)
                   values (%s,%s) on conflict do nothing""",
                (conversation["id"], student_id),
            )

    @staticmethod
    def _notification(
        connection: Any,
        user_id: UUID,
        kind: str,
        title: str,
        body: str,
        entity_type: str,
        entity_id: UUID,
    ) -> None:
        if kind == "session_upcoming":
            connection.execute(
                """insert into notifications(user_id,kind,title,body,entity_type,entity_id)
                   values (%s,%s,%s,%s,%s,%s)
                   on conflict (user_id,kind,entity_id)
                     where kind='session_upcoming' and entity_id is not null
                   do nothing""",
                (user_id, kind, title, body, entity_type, entity_id),
            )
            return
        connection.execute(
            """insert into notifications(user_id,kind,title,body,entity_type,entity_id)
               values (%s,%s,%s,%s,%s,%s)""",
            (user_id, kind, title, body, entity_type, entity_id),
        )
