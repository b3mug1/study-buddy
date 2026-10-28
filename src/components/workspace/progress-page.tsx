"use client";

import { useI18n } from "@/lib/i18n";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { StudyGoal, StudyGoalTopic } from "@/lib/api-types";

type ProgressData = {
  summary: {
    week_starts_at: string;
    completed_sessions: number;
    study_minutes: number;
  };
  subjects: Array<{
    subject: string;
    completed_sessions: number;
    study_minutes: number;
  }>;
};

export function ProgressPage() {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [progress, setProgress] = useState<ProgressData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [goalData, progressData] = await Promise.all([
        authenticatedApiJson<StudyGoal[]>("goals"),
        authenticatedApiJson<ProgressData>("progress"),
      ]);
      setGoals(goalData);
      setProgress(progressData);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load study progress.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      await authenticatedApiJson<StudyGoal>("goals", {
        method: "POST",
        body: JSON.stringify({
          subject: values.get("subject"),
          target_sessions: Number(values.get("target_sessions")),
          target_date: values.get("target_date") || null,
        }),
      });
      form.reset();
      toast.success(t("Study goal added."));
      await load();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Could not add this goal.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(goalId: string) {
    try {
      await authenticatedApiRequest(`goals/${goalId}`, { method: "DELETE" });
      setGoals((current) => current.filter((goal) => goal.id !== goalId));
      toast.success(t("Study goal removed."));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove this goal.",
      );
    }
  }

  const summary = progress?.summary;
  const weekLabel = summary?.week_starts_at
    ? new Date(summary.week_starts_at).toLocaleDateString(intlLocale, {
        month: "long",
        day: "numeric",
      })
    : t("This week");

  return (
    <main className="mx-auto max-w-5xl">
      <div>
        <p className="text-sm font-semibold text-primary">
          {t("Keep your momentum")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t("Study progress")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Set a weekly goal for each subject and see your completed study sessions.",
          )}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error}
        </p>
      )}

      <section
        className="mt-6 grid gap-4 sm:grid-cols-3"
        aria-label={t("Weekly summary")}
      >
        <article className="surface p-5">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <BookOpenCheck size={18} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Completed sessions")}
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {summary?.completed_sessions ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Since")} {weekLabel}
          </p>
        </article>
        <article className="surface p-5">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <Clock3 size={18} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Study time")}
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {summary ? Math.floor(summary.study_minutes / 60) : "—"}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              {t("hours short")}
            </span>{" "}
            {summary ? summary.study_minutes % 60 : ""}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              {t("minutes short")}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("From completed sessions")}
          </p>
        </article>
        <article className="surface p-5">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <Target size={18} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Active subject goals")}
          </p>
          <p className="mt-1 text-3xl font-semibold">{goals.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Track them below")}
          </p>
        </article>
      </section>

      <section className="surface mt-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <CalendarDays size={19} className="text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t("Goals by subject")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Choose how many sessions to complete this week.")}
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void addGoal(event)}
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1fr_auto]"
        >
          <label className="text-xs font-semibold">
            {t("Subject")}
            <input
              name="subject"
              minLength={1}
              maxLength={80}
              required
              className="field-control mt-1.5"
              placeholder={t("Calculus")}
            />
          </label>
          <label className="text-xs font-semibold">
            {t("Sessions this week")}
            <input
              name="target_sessions"
              type="number"
              min={1}
              max={100}
              defaultValue={3}
              required
              className="field-control mt-1.5"
            />
          </label>
          <label className="text-xs font-semibold">
            {t("Target date (optional)")}
            <input
              name="target_date"
              type="date"
              className="field-control mt-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            {t("Add goal")}
          </button>
        </form>

        {loading ? (
          <div className="mt-5 h-28 animate-pulse rounded-md bg-muted/60" />
        ) : goals.length ? (
          <ul className="mt-5 space-y-3">
            {goals.map((goal) => {
              const done = goal.completed_this_week ?? 0;
              const percent = Math.min(
                100,
                Math.round((done / goal.target_sessions) * 100),
              );
              return (
                <li
                  key={goal.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold">{goal.subject}</h3>
                        <span className="text-xs font-medium text-muted-foreground">
                          {done} / {goal.target_sessions} {t("sessions")}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t("{subject} weekly progress", {
                          subject: goal.subject,
                        })}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {goal.target_date && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("Target date:")}{" "}
                          {new Date(
                            `${goal.target_date}T12:00:00`,
                          ).toLocaleDateString(intlLocale)}
                        </p>
                      )}
                      <GoalTopicChecklist
                        goalId={goal.id}
                        topics={goal.topics ?? []}
                        onChanged={load}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteGoal(goal.id)}
                      aria-label={t("Remove goal: {subject}", {
                        subject: goal.subject,
                      })}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover: "
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 rounded-md bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            {t("No goals set. Add a subject above to start your weekly plan.")}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">{t("Completed this week by subject")}</h2>
        <div className="surface mt-3 p-4">
          {progress?.subjects.length ? (
            <ul className="divide-y divide-border">
              {progress.subjects.map((item) => (
                <li
                  key={item.subject}
                  className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1"
                >
                  <span className="font-medium">{item.subject}</span>
                  <span className="text-right text-sm text-muted-foreground">
                    {item.completed_sessions} {t("sessions")} ·{" "}
                    {t("{count} minutes", { count: item.study_minutes })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              {t("Completed sessions will be counted here.")}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function GoalTopicChecklist({
  goalId,
  topics,
  onChanged,
}: {
  goalId: string;
  topics: StudyGoalTopic[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  async function addTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      await authenticatedApiJson<StudyGoalTopic>(`goals/${goalId}/topics`, {
        method: "POST",
        body: JSON.stringify({ topic: values.get("topic") }),
      });
      form.reset();
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add this topic.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTopic(topic: StudyGoalTopic) {
    setSaving(true);
    try {
      await authenticatedApiRequest(`goals/${goalId}/topics/${topic.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !topic.completed }),
      });
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update this topic.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTopic(topicId: string) {
    setSaving(true);
    try {
      await authenticatedApiRequest(`goals/${goalId}/topics/${topicId}`, {
        method: "DELETE",
      });
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this topic.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-semibold">{t("Topics to complete")}</p>
      {topics.length > 0 && (
        <ul className="mt-2 space-y-1">
          {topics.map((topic) => (
            <li key={topic.id} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={topic.completed}
                  disabled={saving}
                  onChange={() => void toggleTopic(topic)}
                  className="size-4 "
                />
                <span
                  className={
                    topic.completed
                      ? "truncate text-muted-foreground line-through"
                      : "truncate"
                  }
                >
                  {topic.topic}
                </span>
                {topic.completed && (
                  <Check
                    size={13}
                    className="shrink-0 text-primary"
                    aria-label={t("Completed")}
                  />
                )}
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteTopic(topic.id)}
                aria-label={t("Remove topic {topic}", { topic: topic.topic })}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover: disabled:opacity-50 "
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => void addTopic(event)}
        className="mt-2 flex gap-2"
      >
        <label className="sr-only" htmlFor={`topic-${goalId}`}>
          {t("Add a study topic")}
        </label>
        <input
          id={`topic-${goalId}`}
          name="topic"
          minLength={2}
          maxLength={160}
          required
          placeholder={t("Add a topic to study")}
          className="field-control h-9 text-xs"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          <Plus size={13} aria-hidden="true" /> {t("Topic")}
        </button>
      </form>
    </div>
  );
}
