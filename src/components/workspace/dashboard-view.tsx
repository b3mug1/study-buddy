import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageCircle,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/navigation/link";
import { authenticatedApiJson } from "@/lib/api-client";
import type { DashboardData, GroupTask, StudyGoal } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";

type WeeklyProgress = {
  summary: {
    week_starts_at: string;
    completed_sessions: number;
    study_minutes: number;
  };
};

type DashboardTask = GroupTask & { group_name: string };

function getTaskDateLabel(
  date: string | null,
  locale: string,
  t: (key: string) => string,
) {
  if (!date) return t("No due date");
  return new Date(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function DashboardView() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData>();
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [progress, setProgress] = useState<WeeklyProgress>();
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [taskLoadError, setTaskLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const dashboard = await authenticatedApiJson<DashboardData>("dashboard");
      setData(dashboard);

      const [goalResult, progressResult, taskResult] = await Promise.allSettled(
        [
          authenticatedApiJson<StudyGoal[]>("goals"),
          authenticatedApiJson<WeeklyProgress>("progress"),
          Promise.allSettled(
            dashboard.study_groups.map(async (group) => {
              const groupTasks = await authenticatedApiJson<GroupTask[]>(
                `groups/${group.id}/tasks`,
              );
              return groupTasks.map((task) => ({
                ...task,
                group_name: group.name,
              }));
            }),
          ),
        ],
      );

      if (goalResult.status === "fulfilled") setGoals(goalResult.value);
      if (progressResult.status === "fulfilled")
        setProgress(progressResult.value);
      if (taskResult.status === "fulfilled") {
        const successfulGroups = taskResult.value.filter(
          (result): result is PromiseFulfilledResult<DashboardTask[]> =>
            result.status === "fulfilled",
        );
        const failedGroups = taskResult.value.length - successfulGroups.length;
        setTasks(
          successfulGroups
            .flatMap((result) => result.value)
            .filter((task) => task.status !== "done")
            .sort((left, right) => {
              if (!left.due_at) return right.due_at ? 1 : 0;
              if (!right.due_at) return -1;
              return left.due_at.localeCompare(right.due_at);
            })
            .slice(0, 4),
        );
        setTaskLoadError(failedGroups > 0);
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

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        {t("Loading your study space…")}
      </div>
    );
  }

  if (!data) {
    return (
      <div role="alert" className="surface p-5 text-sm text-destructive">
        {error || t("Unable to load your dashboard.")}
      </div>
    );
  }

  const { profile } = data;
  const firstName = profile.full_name.trim().split(/\s+/)[0] || "";
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const upcomingSession = data.upcoming_sessions[0];
  const unreadMessages = data.recent_conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );
  const completedGoalSessions = goals.reduce(
    (total, goal) => total + (goal.completed_this_week ?? 0),
    0,
  );
  const targetGoalSessions = goals.reduce(
    (total, goal) => total + goal.target_sessions,
    0,
  );
  const goalProgress = targetGoalSessions
    ? Math.min(
        100,
        Math.round((completedGoalSessions / targetGoalSessions) * 100),
      )
    : 0;
  const currentDate = new Date();
  const today = currentDate.toLocaleDateString(intlLocale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const todayIso = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  return (
    <main className="dashboard-page">
      <header className="dashboard-heading" data-motion>
        <div>
          <p className="academic-kicker">{profile.university_name}</p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
            {t("Your study week")}
          </h1>
          <p className="dashboard-meta mt-2">
            <span>{t("Good to see you, {name}.", { name: firstName })}</span>
            <span className="dashboard-meta-divider" aria-hidden="true">
              /
            </span>
            <time dateTime={todayIso}>{today}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {data.unread_notifications > 0 && (
            <Link href="/notifications" className="portal-inline-link">
              <Bell size={15} aria-hidden="true" />
              {t("{count} unread notifications", {
                count: data.unread_notifications,
              })}
            </Link>
          )}
          <Link href="/sessions" className="portal-button">
            <CalendarDays size={16} aria-hidden="true" />
            {t("Plan a study session")}
          </Link>
        </div>
      </header>

      {error && (
        <p
          role="status"
          className="mt-5 border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground dark:bg-accent dark:text-accent-foreground"
        >
          {error}
        </p>
      )}

      <section className="dashboard-grid mt-6" aria-label={t("Study overview")}>
        <article
          className="portal-card dashboard-card dashboard-card--session"
          data-motion
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("Upcoming sessions")}</p>
              <h2 className="mt-1 text-xl">{t("Next session")}</h2>
            </div>
            <CalendarDays
              className="text-primary"
              size={19}
              aria-hidden="true"
            />
          </div>

          {upcomingSession ? (
            <div className="session-summary">
              <div className="session-date" aria-hidden="true">
                <span>
                  {new Date(upcomingSession.starts_at).toLocaleDateString(
                    intlLocale,
                    {
                      month: "short",
                    },
                  )}
                </span>
                <strong>
                  {new Date(upcomingSession.starts_at).toLocaleDateString(
                    intlLocale,
                    {
                      day: "numeric",
                    },
                  )}
                </strong>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {upcomingSession.subject}: {upcomingSession.topic}
                </p>
                <time
                  className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"
                  dateTime={upcomingSession.starts_at}
                >
                  <Clock3 size={14} aria-hidden="true" />
                  {new Date(upcomingSession.starts_at).toLocaleString(
                    intlLocale,
                    {
                      weekday: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}
                  <span aria-hidden="true">·</span>
                  {t(upcomingSession.study_format)}
                </time>
              </div>
            </div>
          ) : (
            <div className="portal-empty-state">
              <p>{t("No sessions scheduled yet.")}</p>
              <Link href="/sessions" className="portal-inline-link">
                {t("Plan a study session")}{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}

          <Link href="/sessions" className="portal-card-footer">
            {t("View study sessions")}{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>

        <article
          className="portal-card dashboard-card"
          data-motion
          data-motion-delay="50"
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("This week")}</p>
              <h2 className="mt-1 text-xl">{t("Weekly progress")}</h2>
            </div>
            <Target className="text-primary" size={19} aria-hidden="true" />
          </div>

          <div className="weekly-stat">
            <strong>{progress?.summary.completed_sessions ?? 0}</strong>
            <span>{t("Completed sessions")}</span>
          </div>
          <div className="goal-progress-label">
            <span>{t("Goal sessions")}</span>
            <span>
              {completedGoalSessions} / {targetGoalSessions}
            </span>
          </div>
          <div
            className="portal-progress-track"
            role="progressbar"
            aria-label={t("Weekly goal progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={goalProgress}
          >
            <span style={{ width: `${goalProgress}%` }} />
          </div>
          <Link href="/progress" className="portal-card-footer">
            {goals.length ? t("Manage study goals") : t("Set a weekly goal")}{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>

        <article
          className="portal-card dashboard-card"
          data-motion
          data-motion-delay="100"
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("From your study groups")}</p>
              <h2 className="mt-1 text-xl">{t("Tasks to complete")}</h2>
            </div>
            <CheckCircle2
              className="text-primary"
              size={19}
              aria-hidden="true"
            />
          </div>

          {tasks.length ? (
            <ul className="portal-list">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/groups/${task.group_id}`}
                    className="portal-task-link"
                  >
                    <span className="portal-task-marker" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {task.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {task.group_name} ·{" "}
                        {t(
                          task.status === "todo"
                            ? "To do"
                            : task.status === "in_progress"
                              ? "In progress"
                              : "Completed",
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {getTaskDateLabel(task.due_at, intlLocale, t)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="portal-empty-state">
              <p>
                {t(
                  taskLoadError
                    ? "Tasks are temporarily unavailable."
                    : "No open tasks in your groups.",
                )}
              </p>
              <Link href="/groups" className="portal-inline-link">
                {t("Open study groups")}{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
          {tasks.length > 0 && taskLoadError && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {t("Some group tasks could not be loaded.")}
            </p>
          )}
          <Link href="/groups" className="portal-card-footer">
            {t("View study groups")} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>

        <article
          className="portal-card dashboard-card"
          data-motion
          data-motion-delay="150"
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("Recent activity")}</p>
              <h2 className="mt-1 text-xl">{t("Messages")}</h2>
            </div>
            <span
              className="portal-count"
              aria-label={t("{count} unread messages", {
                count: unreadMessages,
              })}
            >
              {unreadMessages}
            </span>
          </div>

          {data.recent_conversations.length ? (
            <ul className="portal-list">
              {data.recent_conversations.slice(0, 3).map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/messages/${conversation.id}`}
                    className="portal-message-link"
                  >
                    <span className="portal-message-icon" aria-hidden="true">
                      <MessageCircle size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {conversation.last_message ??
                          t("Start the conversation")}
                      </span>
                    </span>
                    {conversation.unread_count > 0 && (
                      <span className="portal-unread-count">
                        {conversation.unread_count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="portal-empty-state">
              <p>
                {t(
                  "Connect with a student or join a group to start a conversation.",
                )}
              </p>
            </div>
          )}
          <Link href="/messages" className="portal-card-footer">
            {unreadMessages
              ? t("Open unread messages")
              : t("View all messages")}{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <article
          className="portal-card p-5 sm:p-6"
          data-motion
          data-motion-delay="200"
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("Your learning community")}</p>
              <h2 className="mt-1 text-xl">{t("Your study groups")}</h2>
            </div>
            <Link href="/groups" className="portal-inline-link">
              {t("View all")} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {data.study_groups.length ? (
            <ul className="portal-list">
              {data.study_groups.slice(0, 4).map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="portal-message-link"
                  >
                    <span className="portal-message-icon" aria-hidden="true">
                      <BookOpen size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {group.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {group.subject} ·{" "}
                        {t("{count} members", { count: group.member_count })}
                      </span>
                    </span>
                    <ArrowRight
                      size={15}
                      className="text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-sm text-muted-foreground">
              {t("Join or create a study group to see it here.")}
            </p>
          )}
        </article>

        <article
          className="portal-card p-5 sm:p-6"
          data-motion
          data-motion-delay="250"
        >
          <div className="portal-card-heading">
            <div>
              <p className="academic-kicker">{t("Matched to your profile")}</p>
              <h2 className="mt-1 text-xl">{t("Study partners to explore")}</h2>
            </div>
            <Link href="/discover" className="portal-inline-link">
              {t("Discover")} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {data.recommended_students.length ? (
            <ul className="portal-list">
              {data.recommended_students.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/profile/${student.id}`}
                    className="portal-message-link"
                  >
                    <span className="portal-student-avatar" aria-hidden="true">
                      {student.full_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {student.full_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {student.major} ·{" "}
                        {student.shared_subjects.join(", ") ||
                          t("No shared subjects yet")}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {student.compatibility}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-sm text-muted-foreground">
              {t("No other opted-in student profiles are available yet.")}
            </p>
          )}
        </article>
      </section>

      <section
        className="profile-completion mt-5"
        data-motion
        data-motion-delay="300"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={17} className="text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">{t("Profile completion")}</p>
          <span className="text-sm tabular-nums text-muted-foreground">
            {data.profile_completion}%
          </span>
        </div>
        <div className="portal-progress-track flex-1" aria-hidden="true">
          <span style={{ width: `${data.profile_completion}%` }} />
        </div>
        <Link href="/settings/profile" className="portal-inline-link shrink-0">
          {t("Update your profile")} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
