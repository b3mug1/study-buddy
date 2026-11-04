import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  LoaderCircle,
  MessageCircle,
  Plus,
  UsersRound,
} from "lucide-react";
import Link from "@/components/navigation/link";
import type { DeskContext } from "@/components/app/app-layout";
import { authenticatedApiJson } from "@/lib/api-client";
import type {
  DashboardData,
  GroupTask,
  StudyGoal,
  StudySession,
} from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";
import { loadNotes } from "@/lib/study-notes";

type GroupTaskWithGroup = GroupTask & { group_name: string; subject: string };

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="campus-section__heading">
      <h2>{title}</h2>
      <Link href={href} className="campus-text-link">
        {linkLabel} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function DashboardView() {
  const { t, locale } = useI18n();
  const { profile } = useOutletContext<DeskContext>();
  const [data, setData] = useState<DashboardData>();
  const [tasks, setTasks] = useState<GroupTaskWithGroup[]>([]);
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [sessionDetails, setSessionDetails] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState(false);
  const notes = loadNotes(profile.id);
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";

  const load = useCallback(async () => {
    try {
      const dashboard = await authenticatedApiJson<DashboardData>("dashboard");
      setData(dashboard);
      const [goalResult, taskResult, sessionResult] = await Promise.allSettled([
        authenticatedApiJson<StudyGoal[]>("goals"),
        Promise.allSettled(
          dashboard.study_groups.map(async (group) => {
            const groupTasks = await authenticatedApiJson<GroupTask[]>(
              `groups/${group.id}/tasks`,
            );
            return groupTasks.map((task) => ({
              ...task,
              group_name: group.name,
              subject: group.subject,
            }));
          }),
        ),
        authenticatedApiJson<StudySession[]>(
          "sessions?upcoming_only=true&limit=5",
        ),
      ]);
      if (goalResult.status === "fulfilled") setGoals(goalResult.value);
      if (sessionResult.status === "fulfilled")
        setSessionDetails(sessionResult.value);
      if (taskResult.status === "fulfilled") {
        setTaskError(
          taskResult.value.some((result) => result.status === "rejected"),
        );
        setTasks(
          taskResult.value
            .filter(
              (
                result,
              ): result is PromiseFulfilledResult<GroupTaskWithGroup[]> =>
                result.status === "fulfilled",
            )
            .flatMap((result) => result.value)
            .filter((task) => task.status !== "done")
            .sort((left, right) => {
              if (!left.due_at) return right.due_at ? 1 : 0;
              if (!right.due_at) return -1;
              return left.due_at.localeCompare(right.due_at);
            }),
        );
      } else {
        setTaskError(true);
      }
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Unable to load your dashboard."),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (loading)
    return (
      <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        {t("Loading your study space...")}
      </div>
    );
  if (!data)
    return (
      <div role="alert" className="surface p-5 text-sm text-destructive">
        {error || t("Unable to load your dashboard.")}
      </div>
    );

  const sessions = [...data.upcoming_sessions].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  const nextSession = sessions[0];
  const nextDetails = sessionDetails.find(
    (session) => session.id === nextSession?.id,
  );
  const attending =
    nextDetails?.participants.filter(
      (participant) => participant.status === "accepted",
    ) ?? [];
  const completed = goals.reduce(
    (total, goal) => total + (goal.completed_this_week ?? 0),
    0,
  );
  const target = goals.reduce((total, goal) => total + goal.target_sessions, 0);
  const unreadMessages = data.recent_conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );
  const dateFormat = new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const sessionDate = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const sessionTime = new Intl.DateTimeFormat(intlLocale, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="dashboard-page campus-dashboard">
      <header className="campus-dashboard__intro">
        <div>
          <p className="campus-kicker">
            {profile.university_name || t("Your study space")}
          </p>
          <h1>{t("Your campus, your people.")}</h1>
          <p className="campus-dashboard__welcome">
            {t("Good to see you, {name}.", {
              name: profile.full_name.trim().split(/\s+/)[0] || "",
            })}
          </p>
        </div>
        <p className="campus-dashboard__date">
          <CalendarDays size={17} aria-hidden="true" />
          {dateFormat.format(new Date())}
        </p>
      </header>
      {error && (
        <p role="status" className="campus-notice">
          {error}
        </p>
      )}

      <div className="campus-dashboard__lead">
        <section
          className="campus-session"
          aria-labelledby="next-session-heading"
        >
          <div className="campus-session__topline">
            <span className="campus-kicker">{t("Next session")}</span>
            <span className="campus-session__index">
              {nextSession ? "01" : "00"} /{" "}
              {String(sessions.length).padStart(2, "0")}
            </span>
          </div>
          {nextSession ? (
            <>
              <div className="campus-session__content">
                <div>
                  <p className="campus-session__subject">
                    {nextSession.subject}
                  </p>
                  <h2 id="next-session-heading">
                    {nextSession.topic || nextSession.subject}
                  </h2>
                </div>
                <div className="campus-session__date">
                  <strong>
                    {new Intl.DateTimeFormat(intlLocale, {
                      day: "2-digit",
                    }).format(new Date(nextSession.starts_at))}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat(intlLocale, {
                      month: "short",
                    }).format(new Date(nextSession.starts_at))}
                  </span>
                </div>
              </div>
              <div className="campus-session__footer">
                <div className="campus-session__meta">
                  <p>
                    <Clock3 size={16} aria-hidden="true" />
                    {sessionDate.format(new Date(nextSession.starts_at))} ·{" "}
                    {sessionTime.format(new Date(nextSession.starts_at))} ·{" "}
                    {t(nextSession.study_format)}
                  </p>
                  {nextDetails?.meeting_details && (
                    <p className="campus-session__location">
                      {nextDetails.meeting_details}
                    </p>
                  )}
                  {attending.length > 0 && (
                    <div className="campus-session__attendees">
                      <span
                        className="campus-session__avatars"
                        aria-hidden="true"
                      >
                        {attending.slice(0, 3).map((person) => (
                          <span key={person.student_id}>
                            {person.full_name
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("")}
                          </span>
                        ))}
                      </span>
                      <span>
                        {t("{count} attending", { count: attending.length })}
                      </span>
                    </div>
                  )}
                </div>
                <Link href="/sessions" className="campus-session__action">
                  {t("Open session")}{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </>
          ) : (
            <div className="campus-session__empty">
              <h2 id="next-session-heading">
                {t("No upcoming sessions yet.")}
              </h2>
              <p>{t("Make time to study together this week.")}</p>
              <Link href="/sessions" className="campus-session__action">
                {t("Plan a study session")}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
        <section className="campus-partner" aria-labelledby="partner-heading">
          <div className="campus-partner__mark">
            <UsersRound size={23} aria-hidden="true" />
          </div>
          <p className="campus-kicker">{t("Study together")}</p>
          <h2 id="partner-heading">{t("Find a study partner")}</h2>
          <p>
            {t(
              "Find someone taking the same subjects and make the next session easier to start.",
            )}
          </p>
          {data.recommended_students.length > 0 && (
            <p className="campus-partner__match">
              {data.recommended_students.length === 1
                ? t("1 student to meet")
                : t("{count} students to meet", {
                    count: data.recommended_students.length,
                  })}
            </p>
          )}
          {data.recommended_students.length > 0 && (
            <div className="campus-partner__people">
              {data.recommended_students.slice(0, 2).map((student) => (
                <Link href={`/profile/${student.id}`} key={student.id}>
                  <span aria-hidden="true">
                    {student.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  {student.full_name}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
          <Link href="/discover" className="campus-button">
            {t("Explore students")} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>

      <div className="campus-dashboard__columns">
        <div className="campus-dashboard__main-column">
          <section className="campus-section campus-groups">
            <SectionHeading
              title={t("My study groups")}
              href="/groups"
              linkLabel={t("View all groups")}
            />
            <div className="campus-groups__list">
              {data.study_groups.length ? (
                data.study_groups.slice(0, 3).map((group, index) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="campus-group"
                  >
                    <span className="campus-group__number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="campus-group__body">
                      <strong>{group.name}</strong>
                      <span>{group.subject}</span>
                    </span>
                    <span className="campus-group__members">
                      <UsersRound size={14} aria-hidden="true" />
                      {t("{count} members", { count: group.member_count })}
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ))
              ) : (
                <div className="campus-empty">
                  <p>{t("You have not joined a study group yet.")}</p>
                  <Link href="/groups" className="campus-text-link">
                    {t("Browse study groups")}{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </section>
          <section className="campus-section campus-timetable">
            <SectionHeading
              title={t("Your schedule")}
              href="/sessions"
              linkLabel={t("Full schedule")}
            />
            <div className="campus-timetable__list">
              {sessions.length ? (
                sessions.slice(0, 4).map((session) => (
                  <Link
                    href="/sessions"
                    key={session.id}
                    className="campus-timetable__row"
                  >
                    <time dateTime={session.starts_at}>
                      <strong>
                        {sessionTime.format(new Date(session.starts_at))}
                      </strong>
                      <span>
                        {sessionDate.format(new Date(session.starts_at))}
                      </span>
                    </time>
                    <span className="campus-timetable__detail">
                      <strong>{session.topic || session.subject}</strong>
                      <span>{session.subject}</span>
                    </span>
                    <span className="campus-timetable__format">
                      {t(session.study_format)}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ))
              ) : (
                <div className="campus-empty">
                  <p>{t("Your timetable is clear for now.")}</p>
                  <Link href="/sessions" className="campus-text-link">
                    {t("Schedule session")}{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="campus-dashboard__side-column">
          <section className="campus-section campus-tasks">
            <SectionHeading
              title={t("Coming up")}
              href="/groups"
              linkLabel={t("All tasks")}
            />
            {taskError && (
              <p role="status" className="campus-task-error">
                {t("Some group tasks could not be loaded.")}
              </p>
            )}
            {tasks.length ? (
              <ul>
                {tasks.slice(0, 4).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/groups/${task.group_id}`}
                      className="campus-task"
                    >
                      <span className="campus-task__box" aria-hidden="true" />
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.subject || task.group_name}
                          {task.due_at
                            ? ` · ${new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(new Date(task.due_at))}`
                            : ""}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="campus-empty">
                {t("No group tasks due right now.")}
              </p>
            )}
          </section>
          <section className="campus-section campus-quick">
            <h2>{t("Make a move")}</h2>
            <Link href="/groups" className="campus-quick__link">
              <Plus size={17} aria-hidden="true" />
              {t("Create a study group")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/sessions" className="campus-quick__link">
              <CalendarDays size={17} aria-hidden="true" />
              {t("Plan a study session")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/notes" className="campus-quick__link">
              <FileText size={17} aria-hidden="true" />
              {t("Add a study note")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/materials" className="campus-quick__link">
              <BookOpen size={17} aria-hidden="true" />
              {t("Share a material")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          {target > 0 && (
            <section className="campus-section campus-goal">
              <div className="campus-section__heading">
                <h2>{t("This week")}</h2>
                <Link href="/progress" className="campus-text-link">
                  {t("Study goals")} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <p>
                <strong>{completed}</strong> / {target}{" "}
                {t("sessions toward your goal")}
              </p>
              <div
                className="campus-goal__track"
                role="progressbar"
                aria-valuenow={Math.min(completed, target)}
                aria-valuemin={0}
                aria-valuemax={target}
                aria-label={t("Weekly study goal")}
              >
                <span
                  style={{
                    width: `${Math.min(100, (completed / target) * 100)}%`,
                  }}
                />
              </div>
            </section>
          )}
          <section className="campus-section campus-profile-progress">
            <div className="campus-section__heading">
              <h2>{t("Profile completion")}</h2>
              <Link href="/settings/profile" className="campus-text-link">
                {t("Update your profile")}{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="campus-profile-progress__row">
              <strong>{data.profile_completion}%</strong>
              <div
                className="campus-goal__track"
                role="progressbar"
                aria-valuenow={data.profile_completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("Profile completion")}
              >
                <span style={{ width: `${data.profile_completion}%` }} />
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="campus-dashboard__foot">
        <section className="campus-section">
          <SectionHeading
            title={t("My notes")}
            href="/notes"
            linkLabel={t("Open notes")}
          />
          <div className="campus-foot-list">
            {notes.length ? (
              notes.slice(0, 2).map((note) => (
                <Link key={note.id} href="/notes">
                  <BookOpen size={17} aria-hidden="true" />
                  <span>{note.title}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className="campus-empty">
                {t("Write down key ideas before your next session.")}
              </p>
            )}
          </div>
        </section>
        <section className="campus-section">
          <SectionHeading
            title={t("Conversations")}
            href="/messages"
            linkLabel={t("View all messages")}
          />
          <div className="campus-foot-list">
            {data.recent_conversations.length ? (
              data.recent_conversations.slice(0, 2).map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  <span>{conversation.title}</span>
                  {conversation.unread_count > 0 && (
                    <b>{conversation.unread_count}</b>
                  )}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className="campus-empty">{t("No conversations yet.")}</p>
            )}
          </div>
          {unreadMessages > 0 && (
            <p className="campus-foot-note">
              {t("{count} unread messages", { count: unreadMessages })}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
