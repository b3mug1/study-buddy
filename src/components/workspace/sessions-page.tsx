"use client";

import { useI18n } from "@/lib/i18n";
import {
  CalendarDays,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { Connection, StudySession } from "@/lib/api-types";

type CalendarMonth = {
  year: number;
  month: number;
  label: string;
  leadingDays: number;
  totalDays: number;
};

export function SessionsPage() {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const load = useCallback(async () => {
    try {
      const [sessionData, connectionData, historyData] = await Promise.all([
        authenticatedApiJson<StudySession[]>("sessions?upcoming_only=true"),
        authenticatedApiJson<Connection[]>("connections"),
        authenticatedApiJson<StudySession[]>("sessions/history?limit=30"),
      ]);
      setSessions(sessionData);
      setHistory(historyData);
      setConnections(
        connectionData.filter((item) => item.status === "accepted"),
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load study sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    void Promise.resolve().then(() => setCurrentTime(Date.now()));
    const refresh = window.setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => window.clearInterval(refresh);
  }, []);

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreating(true);
    const form = new FormData(formElement);
    const localStart = String(form.get("starts_at") ?? "");
    const invitedUserIds = form
      .getAll("invited_user_ids")
      .map((value) => String(value));
    try {
      await authenticatedApiJson<{ id: string }>("sessions", {
        method: "POST",
        body: JSON.stringify({
          subject: form.get("subject"),
          topic: form.get("topic"),
          starts_at: new Date(localStart).toISOString(),
          duration_minutes: Number(form.get("duration_minutes")),
          study_format: form.get("study_format"),
          meeting_details: form.get("meeting_details"),
          max_participants: Math.max(2, invitedUserIds.length + 1),
          invited_user_ids: invitedUserIds,
        }),
      });
      toast.success(t("Study session scheduled."));
      formElement.reset();
      await load();
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Could not schedule this study session.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function respond(sessionId: string, accept: boolean) {
    setBusyId(sessionId);
    try {
      await authenticatedApiRequest(`sessions/${sessionId}/invitation`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });
      toast.success(accept ? t("You’re in.") : t("Invitation declined."));
      await load();
    } catch (responseError) {
      toast.error(
        responseError instanceof Error
          ? responseError.message
          : "Could not update this invitation.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function cancel(sessionId: string) {
    setBusyId(sessionId);
    try {
      await authenticatedApiRequest(`sessions/${sessionId}`, {
        method: "DELETE",
      });
      toast.success(t("Study session cancelled."));
      await load();
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : "Could not cancel this session.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function complete(sessionId: string) {
    setBusyId(sessionId);
    try {
      await authenticatedApiRequest(`sessions/${sessionId}/complete`, {
        method: "POST",
        body: "{}",
      });
      toast.success(t("Study session marked as completed."));
      await load();
    } catch (completeError) {
      toast.error(
        completeError instanceof Error
          ? completeError.message
          : "Could not complete this session.",
      );
    } finally {
      setBusyId("");
    }
  }

  function showCalendar() {
    const anchor = sessions[0] ? new Date(sessions[0].starts_at) : new Date();
    setCalendar(makeCalendarMonth(anchor, intlLocale));
    setView("calendar");
  }

  function shiftCalendarMonth(offset: number) {
    if (!calendar) return;
    setCalendar(
      makeCalendarMonth(
        new Date(calendar.year, calendar.month + offset, 1),
        intlLocale,
      ),
    );
  }

  const connectedStudents = connections;

  return (
    <main>
      <div>
        <p className="text-sm font-semibold text-primary">
          {t("Make a plan, learn together")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Study sessions")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t(
            "Schedule a session, invite connected students, and manage responses in one place.",
          )}
        </p>
      </div>

      <section className="surface mt-7 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <CalendarPlus size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">{t("Plan a study session")}</h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "Choose a timezone-aware start time and invite your connections.",
              )}
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => void createSession(event)}
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm font-medium">
            {t("Subject")}
            <input
              name="subject"
              required
              maxLength={80}
              className="field-control mt-1.5"
              placeholder={t("e.g. Biology")}
            />
          </label>
          <label className="text-sm font-medium">
            {t("Topic")}
            <input
              name="topic"
              required
              maxLength={160}
              className="field-control mt-1.5"
              placeholder={t("e.g. Cell membranes")}
            />
          </label>
          <label className="text-sm font-medium">
            {t("Date and time")}
            <input
              name="starts_at"
              required
              type="datetime-local"
              min={localDateTimeMin()}
              className="field-control mt-1.5"
            />
          </label>
          <label className="text-sm font-medium">
            {t("Duration")}
            <select
              name="duration_minutes"
              defaultValue="60"
              className="field-control mt-1.5"
            >
              {[30, 45, 60, 90, 120, 180].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("{count} minutes", { count: minutes })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            {t("Study format")}
            <select
              name="study_format"
              defaultValue="online"
              className="field-control mt-1.5"
            >
              <option value="online">{t("Online")}</option>
              <option value="offline">{t("In person")}</option>
              <option value="hybrid">{t("Hybrid")}</option>
            </select>
          </label>
          <label className="text-sm font-medium lg:col-span-2">
            {t("Invite connected students")}
            <select
              name="invited_user_ids"
              multiple
              className="field-control mt-1.5 min-h-28"
            >
              {connectedStudents.map((connection) => (
                <option
                  key={connection.student_id}
                  value={connection.student_id}
                >
                  {connection.full_name} · {connection.major}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {t("Hold Ctrl (Windows) or Command (Mac) to choose several.")}
            </span>
          </label>
          <label className="text-sm font-medium lg:col-span-2">
            {t("Meeting details")}
            <textarea
              name="meeting_details"
              maxLength={1000}
              rows={3}
              className="field-control mt-1.5 resize-y"
              placeholder={t("Meeting link, library room, or other details")}
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50 lg:col-span-4"
          >
            {creating ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CalendarPlus size={16} aria-hidden="true" />
            )}
            {creating ? t("Scheduling…") : t("Schedule session")}
          </button>
        </form>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error}
        </p>
      )}

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{t("Your upcoming sessions")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Times are shown in your device’s local timezone.")}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {sessions.length}
          </span>
          <div className="ml-2 inline-flex rounded-md border border-border p-1">
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "list" ? "bg-accent text-accent-foreground dark:bg-accent " : "text-muted-foreground"}`}
            >
              {t("List")}
            </button>
            <button
              type="button"
              aria-pressed={view === "calendar"}
              onClick={showCalendar}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "calendar" ? "bg-accent text-accent-foreground dark:bg-accent " : "text-muted-foreground"}`}
            >
              <CalendarDays size={14} aria-hidden="true" /> {t("Calendar")}
            </button>
          </div>
        </div>
        {loading ? (
          <div
            className="surface h-48 animate-pulse bg-muted/60"
            aria-label={t("Loading study sessions")}
          />
        ) : view === "calendar" && calendar ? (
          <SessionCalendar
            sessions={sessions}
            calendar={calendar}
            onShiftMonth={shiftCalendarMonth}
          />
        ) : sessions.length ? (
          <ul className="space-y-3">
            {sessions.map((session) => {
              const myParticipant = session.participants.find(
                (participant) =>
                  participant.student_id === session.current_user_id,
              );
              const myInvite = myParticipant?.status === "invited";
              const isOwner = session.owner_id === session.current_user_id;
              const hasStarted =
                currentTime > 0 &&
                new Date(session.starts_at).getTime() <= currentTime;
              return (
                <li key={session.id} className="surface p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="grid min-w-20 place-items-center rounded-lg bg-accent px-3 py-3 text-center text-accent-foreground dark:bg-accent ">
                      <span className="text-xs font-semibold uppercase">
                        {new Date(session.starts_at).toLocaleDateString(
                          intlLocale,
                          {
                            month: "short",
                          },
                        )}
                      </span>
                      <span className="text-2xl font-bold">
                        {new Date(session.starts_at).getDate()}
                      </span>
                      <span className="text-xs">
                        {new Date(session.starts_at).toLocaleTimeString(
                          intlLocale,
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {session.subject}: {session.topic}
                        </h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {t(session.study_format)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("Organized by")} {session.owner_name} ·{" "}
                        {t("{count} minutes", {
                          count: session.duration_minutes,
                        })}
                      </p>
                      {session.meeting_details && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
                          {session.meeting_details}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={14} aria-hidden="true" />
                          {
                            session.participants.filter(
                              (participant) =>
                                participant.status === "accepted",
                            ).length
                          }{" "}
                          /{" "}
                          {t("{count} attending", {
                            count: session.max_participants,
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {session.study_format === "online" ? (
                            <Video size={14} aria-hidden="true" />
                          ) : (
                            <MapPin size={14} aria-hidden="true" />
                          )}
                          {session.participants
                            .filter(
                              (participant) =>
                                participant.status === "accepted",
                            )
                            .map((participant) => participant.full_name)
                            .join(", ")}
                        </span>
                      </div>
                    </div>
                    {myInvite ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === session.id}
                          onClick={() => void respond(session.id, false)}
                          className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted"
                        >
                          <X size={14} aria-hidden="true" /> {t("Decline")}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === session.id}
                          onClick={() => void respond(session.id, true)}
                          className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
                        >
                          <Check size={14} aria-hidden="true" /> {t("Accept")}
                        </button>
                      </div>
                    ) : myParticipant?.status === "declined" ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {t("Declined")}
                      </span>
                    ) : isOwner && hasStarted ? (
                      <button
                        type="button"
                        disabled={busyId === session.id}
                        onClick={() => void complete(session.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
                      >
                        <Check size={14} aria-hidden="true" />{" "}
                        {t("Mark completed")}
                      </button>
                    ) : isOwner ? (
                      <button
                        type="button"
                        disabled={busyId === session.id}
                        onClick={() => void cancel(session.id)}
                        className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 "
                      >
                        {t("Cancel session")}
                      </button>
                    ) : (
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground dark:bg-accent ">
                        {t("Accepted")}
                      </span>
                    )}
                  </div>
                  {hasStarted && myParticipant?.status === "accepted" && (
                    <SessionOutcomeEditor session={session} onSaved={load} />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="surface flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <CalendarClock
              size={24}
              className="text-primary"
              aria-hidden="true"
            />
            <h3 className="mt-3 font-semibold">{t("No upcoming sessions")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Schedule a session and invite one of your connections.")}
            </p>
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("Recent study outcomes")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Record what the group learned and what to prepare next.")}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {history.length}
          </span>
        </div>
        {history.length ? (
          <ul className="space-y-3">
            {history.map((session) => (
              <li
                key={`${session.id}-${session.summary}-${session.next_steps}`}
                className="surface p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {session.subject}: {session.topic}
                  </h3>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={session.starts_at}
                  >
                    {new Date(session.starts_at).toLocaleDateString(
                      intlLocale,
                      {
                        dateStyle: "medium",
                      },
                    )}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Organized by")} {session.owner_name}
                </p>
                {session.participants.some(
                  (participant) =>
                    participant.status === "accepted" &&
                    participant.student_id === session.current_user_id,
                ) && <SessionOutcomeEditor session={session} onSaved={load} />}
              </li>
            ))}
          </ul>
        ) : (
          <div className="surface px-5 py-6 text-sm text-muted-foreground">
            {t("Completed sessions and their notes will appear here.")}
          </div>
        )}
      </section>
    </main>
  );
}

function SessionOutcomeEditor({
  session,
  onSaved,
}: {
  session: StudySession;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await authenticatedApiRequest(`sessions/${session.id}/outcome`, {
        method: "PUT",
        body: JSON.stringify({
          summary: values.get("summary"),
          next_steps: values.get("next_steps"),
        }),
      });
      toast.success(t("Session notes saved."));
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the session notes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="mt-4 grid gap-3 rounded-md bg-muted/40 p-4 sm:grid-cols-2"
    >
      <label className="text-xs font-semibold">
        {t("What did you study?")}
        <textarea
          name="summary"
          defaultValue={session.summary}
          maxLength={1200}
          rows={3}
          className="field-control mt-1.5 resize-y"
          placeholder={t("Topics, exercises, or questions covered")}
        />
      </label>
      <label className="text-xs font-semibold">
        {t("Prepare for next time")}
        <textarea
          name="next_steps"
          defaultValue={session.next_steps}
          maxLength={1200}
          rows={3}
          className="field-control mt-1.5 resize-y"
          placeholder={t("Tasks or topics for the next session")}
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-9 items-center justify-center gap-2 justify-self-start rounded-md border border-border px-3 text-xs font-semibold hover:bg-card disabled:opacity-50 sm:col-span-2"
      >
        {saving ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <Check size={14} />
        )}
        {t("Save session notes")}
      </button>
    </form>
  );
}

function SessionCalendar({
  sessions,
  calendar,
  onShiftMonth,
}: {
  sessions: StudySession[];
  calendar: CalendarMonth;
  onShiftMonth: (offset: number) => void;
}) {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - calendar.leadingDays + 1;
    return day > 0 && day <= calendar.totalDays ? day : null;
  });

  return (
    <section
      className="surface p-4 sm:p-5"
      aria-label={t("{month} study session calendar", {
        month: calendar.label,
      })}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onShiftMonth(-1)}
          aria-label={t("Previous month")}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          ←
        </button>
        <h3 className="font-semibold">{calendar.label}</h3>
        <button
          type="button"
          onClick={() => onShiftMonth(1)}
          aria-label={t("Next month")}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div
            key={weekday}
            className="py-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {t(weekday)}
          </div>
        ))}
        {cells.map((day, index) => {
          const daySessions =
            day === null
              ? []
              : sessions.filter((session) => {
                  const date = new Date(session.starts_at);
                  return (
                    date.getFullYear() === calendar.year &&
                    date.getMonth() === calendar.month &&
                    date.getDate() === day
                  );
                });
          return (
            <div
              key={`${calendar.year}-${calendar.month}-${index}`}
              className={`min-h-20 rounded-md border p-1.5 sm:min-h-24 sm:p-2 ${day ? "border-border bg-card" : "border-transparent bg-muted/30"}`}
            >
              {day !== null && (
                <>
                  <span className="text-xs font-medium text-muted-foreground">
                    {day}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {daySessions.map((session) => (
                      <li
                        key={session.id}
                        className="truncate rounded-md bg-[var(--color-success)]/12 px-1.5 py-1 text-[10px] font-semibold text-[var(--color-success)]"
                        title={`${session.subject}: ${session.topic}`}
                      >
                        {new Date(session.starts_at).toLocaleTimeString(
                          intlLocale,
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}{" "}
                        {session.subject}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function makeCalendarMonth(date: Date, intlLocale: string): CalendarMonth {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    year,
    month,
    label: new Intl.DateTimeFormat(intlLocale, {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month, 1)),
    leadingDays: new Date(year, month, 1).getDay(),
    totalDays: new Date(year, month + 1, 0).getDate(),
  };
}

function localDateTimeMin() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
