import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  LoaderCircle,
  StickyNote,
  TrendingUp,
  UserRoundPlus,
} from "lucide-react";
import Link from "@/components/navigation/link";
import {
  DeskNotesCard,
  DeskScheduleCard,
  DeskTasksCard,
  type DeskSessionItem,
  type DeskTaskItem,
} from "@/components/workspace/desk-cards";
import type { DeskContext } from "@/components/app/app-layout";
import { authenticatedApiJson } from "@/lib/api-client";
import type { DashboardData, GroupTask, StudyGoal } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";
import { loadNotes, type StudyNote } from "@/lib/study-notes";

type GroupTaskWithGroup = GroupTask & { group_name: string; subject: string };

const MAX_TASKS = 4;

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDueDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DashboardView() {
  const { t, locale } = useI18n();
  const { profile } = useOutletContext<DeskContext>();
  const [data, setData] = useState<DashboardData>();
  const [tasks, setTasks] = useState<GroupTaskWithGroup[]>([]);
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [notes] = useState<StudyNote[]>(() =>
    loadNotes(profile.full_name ?? ""),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";

  const load = useCallback(async () => {
    try {
      const dashboard = await authenticatedApiJson<DashboardData>("dashboard");
      setData(dashboard);

      const [goalResult, taskResult] = await Promise.allSettled([
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
      ]);

      if (goalResult.status === "fulfilled") setGoals(goalResult.value);
      if (taskResult.status === "fulfilled") {
        setTasks(
          taskResult.value
            .filter(
              (
                result,
              ): result is PromiseFulfilledResult<GroupTaskWithGroup[]> =>
                result.status === "fulfilled",
            )
            .flatMap((result) => result.value)
            .sort((left, right) => {
              if (!left.due_at) return right.due_at ? 1 : 0;
              if (!right.due_at) return -1;
              return left.due_at.localeCompare(right.due_at);
            }),
        );
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

  const deskTasks = useMemo<DeskTaskItem[]>(
    () =>
      tasks.slice(0, MAX_TASKS).map((task) => ({
        id: task.id,
        title: task.title,
        groupId: task.group_id,
        groupName: task.group_name,
        subject: task.subject,
        status: task.status,
        dueLabel: formatDueDate(task.due_at, intlLocale, t("No due date")),
        commentCount: 0,
      })),
    [intlLocale, t, tasks],
  );

  const deskSessions = useMemo<DeskSessionItem[]>(
    () =>
      (data?.upcoming_sessions ?? []).map((session) => ({
        id: session.id,
        subject: session.subject,
        topic: session.topic,
        timeLabel: formatTime(session.starts_at, intlLocale),
        ownerName: profile.full_name || t("You"),
        location: session.study_format,
        format: session.study_format,
      })),
    [data, intlLocale, profile.full_name, t],
  );

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        {t("Loading your study space...")}
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
  const unreadMessages = data.recent_conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );

  return (
    <main className="dashboard-page">
      <header className="dashboard-heading" data-motion>
        <div>
          <p className="academic-kicker">{profile.university_name}</p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
            {t("Good to see you, {name}.", {
              name: profile.full_name.trim().split(/\s+/)[0] || "",
            })}
          </h1>
        </div>
        <Link href="/sessions" className="portal-button">
          <BookOpen size={16} aria-hidden="true" />
          {t("Plan a study session")}
        </Link>
      </header>

      {error && (
        <p
          role="status"
          className="mt-5 border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground"
        >
          {error}
        </p>
      )}

      <div className="desk-grid mt-6">
        <DeskTasksCard tasks={deskTasks} />

        <div className="desk-grid__column">
          <DeskNotesCard notes={notes} />
          <DeskScheduleCard sessions={deskSessions} />
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3" data-motion>
        <article className="portal-card">
          <p className="academic-kicker">{t("This week")}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <strong className="text-3xl font-bold tabular-nums text-primary">
              {goalProgress}%
            </strong>
            <span className="text-sm text-muted-foreground">
              {t("of your weekly goal")}
            </span>
          </p>
          <div className="portal-progress-track" aria-hidden="true">
            <span style={{ width: `${goalProgress}%` }} />
          </div>
          <Link href="/progress" className="portal-card-footer">
            {t("Manage study goals")}{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>

        <article className="portal-card">
          <p className="academic-kicker">{t("Recent activity")}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <strong className="text-3xl font-bold tabular-nums text-primary">
              {unreadMessages}
            </strong>
            <span className="text-sm text-muted-foreground">
              {t("unread messages")}
            </span>
          </p>
          <ul className="portal-list">
            {data.recent_conversations.slice(0, 2).map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="portal-message-link"
                >
                  <span className="portal-message-icon" aria-hidden="true">
                    <ArrowLeftRight size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {conversation.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/messages" className="portal-card-footer">
            {t("View all messages")} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>

        <article className="portal-card">
          <p className="academic-kicker">{t("Matched to your profile")}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <strong className="text-3xl font-bold tabular-nums text-primary">
              {data.recommended_students.length}
            </strong>
            <span className="text-sm text-muted-foreground">
              {t("study partners")}
            </span>
          </p>
          <ul className="portal-list">
            {data.recommended_students.slice(0, 2).map((student) => (
              <li key={student.id}>
                <Link
                  href={`/profile/${student.id}`}
                  className="portal-message-link"
                >
                  <span className="portal-student-avatar" aria-hidden="true">
                    {student.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {student.full_name}
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    {student.compatibility}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/discover" className="portal-card-footer">
            {t("Discover")} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="profile-completion mt-5" data-motion>
        <div className="flex items-center gap-3">
          <StickyNote size={17} className="text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">{t("Profile completion")}</p>
          <span className="text-sm tabular-nums text-muted-foreground">
            {data.profile_completion}%
          </span>
        </div>
        <div className="portal-progress-track flex-1" aria-hidden="true">
          <span style={{ width: `${data.profile_completion}%` }} />
        </div>
        <Link href="/settings/profile" className="portal-inline-link shrink-0">
          <TrendingUp size={14} aria-hidden="true" />
          {t("Update your profile")}
        </Link>
      </section>

      <Link href="/discover" className="portal-inline-link mt-5 inline-flex">
        <UserRoundPlus size={14} aria-hidden="true" />
        {t("Find more study partners")}
      </Link>
    </main>
  );
}
