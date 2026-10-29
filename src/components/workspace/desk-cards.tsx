"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronDown,
  MessageSquare,
  Plus,
  StickyNote,
  Video,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useI18n } from "@/lib/i18n";
import type { StudyNote } from "@/lib/study-notes";

export type DeskTaskItem = {
  id: string;
  title: string;
  groupId: string;
  groupName: string;
  subject: string;
  status: "todo" | "in_progress" | "done";
  dueLabel: string;
  commentCount: number;
};

export type DeskSessionItem = {
  id: string;
  subject: string;
  topic: string;
  timeLabel: string;
  ownerName: string;
  location: string;
  format: "online" | "offline" | "hybrid";
};

type TaskFilter = "all" | "todo" | "in_progress" | "done";

const taskFilters: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "All task" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

/** Two-letter avatar initials, shared by the schedule table and profile chips. */
function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "SB";
}

const statusBadgeClass: Record<DeskTaskItem["status"], string> = {
  todo: "desk-task__badge--todo",
  in_progress: "desk-task__badge--in-progress",
  done: "desk-task__badge--done",
};

const statusLabel: Record<DeskTaskItem["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export function DeskTasksCard({ tasks }: { tasks: DeskTaskItem[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TaskFilter>("all");

  const visible = useMemo(
    () =>
      filter === "all" ? tasks : tasks.filter((task) => task.status === filter),
    [filter, tasks],
  );
  const progress = tasks.length
    ? Math.round(
        (tasks.filter((task) => task.status === "done").length / tasks.length) *
          100,
      )
    : 0;

  return (
    <section className="desk-card" data-motion>
      <div className="desk-card__head">
        <h2 className="desk-card__title">{t("My tasks")}</h2>
        <button
          type="button"
          onClick={() => navigate("/groups")}
          aria-label={t("Open your study groups")}
          className="desk-card__add"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        className="desk-filters"
        role="group"
        aria-label={t("Filter tasks by status")}
      >
        {taskFilters.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className="desk-filter"
          >
            {t(option.label)}
          </button>
        ))}
      </div>

      {visible.length ? (
        <ul className="desk-task-list">
          {visible.map((task, index) => (
            <li
              key={task.id}
              className={`desk-task ${index === 0 ? "desk-task--featured" : ""}`}
            >
              <div className="desk-task__row">
                <div className="min-w-0">
                  <p className="desk-task__title">{task.title}</p>
                  <p className="desk-task__subject">
                    {task.subject || task.groupName}
                  </p>
                </div>
                <span
                  className={`desk-task__badge ${statusBadgeClass[task.status]}`}
                >
                  {t(statusLabel[task.status])}
                </span>
              </div>

              {index === 0 && (
                <span
                  className={`desk-stripes ${
                    progress === 0 ? "desk-stripes--neutral" : ""
                  }`}
                  role="img"
                  aria-label={t("{percent}% of your tasks are done", {
                    percent: progress,
                  })}
                >
                  <span
                    className="desk-stripes__fill"
                    style={{ width: `${Math.max(progress, 6)}%` }}
                  />
                </span>
              )}

              <div className="desk-task__foot">
                <span>{task.dueLabel}</span>
                <span className="desk-task__comments">
                  {task.commentCount > 0
                    ? t("{count} comments", { count: task.commentCount })
                    : t("No comments")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="desk-empty">
          <MessageSquare size={18} aria-hidden="true" />
          <p>{t("Nothing here yet.")}</p>
        </div>
      )}

      <Link href="/groups" className="desk-button">
        {t("View all tasks")}
      </Link>
    </section>
  );
}

export function DeskNotesCard({ notes }: { notes: StudyNote[] }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const dateLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";

  return (
    <section className="desk-card" data-motion data-motion-delay="100">
      <div className="desk-card__head">
        <h2 className="desk-card__title">{t("My notes")}</h2>
        <button
          type="button"
          onClick={() => navigate("/notes")}
          aria-label={t("Add a study note")}
          className="desk-card__add"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {notes.length ? (
        <div className="desk-notes__grid">
          {notes.slice(0, 2).map((note, index) => (
            <article
              key={note.id}
              className={`desk-note desk-note--${index % 4}`}
            >
              <div className="desk-note__head">
                <h3 className="desk-note__title">{note.title}</h3>
                <Link
                  href="/notes"
                  className="desk-note__menu"
                  aria-label={t("Open note {title}", { title: note.title })}
                >
                  <span aria-hidden="true">⋯</span>
                </Link>
              </div>
              <p className="desk-note__body">{note.body}</p>
              <p className="desk-note__date">
                {new Date(note.updatedAt).toLocaleDateString(dateLocale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="desk-empty">
          <StickyNote size={18} aria-hidden="true" />
          <p>{t("Write down key ideas before your next session.")}</p>
          <Link href="/notes" className="portal-inline-link">
            {t("Add your first note")}
          </Link>
        </div>
      )}
    </section>
  );
}

export function DeskScheduleCard({
  sessions,
}: {
  sessions: DeskSessionItem[];
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const formatLabel = {
    online: "online",
    offline: "offline",
    hybrid: "hybrid",
  } as const;

  return (
    <section className="desk-card" data-motion data-motion-delay="150">
      <div className="desk-schedule__head">
        <h2 className="desk-card__title">{t("My schedule")}</h2>
        <button
          type="button"
          onClick={() => navigate("/sessions")}
          className="desk-week-picker"
        >
          {t("Next sessions")}
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      {sessions.length ? (
        <table className="desk-table">
          <thead>
            <tr>
              <th scope="col">{t("Time")}</th>
              <th scope="col">{t("Lesson")}</th>
              <th scope="col">{t("Host")}</th>
              <th scope="col">{t("Location")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 6).map((session) => (
              <tr key={session.id}>
                <td className="desk-table__time">{session.timeLabel}</td>
                <td>
                  <Link
                    href="/sessions"
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {session.subject || session.topic}
                  </Link>
                </td>
                <td>
                  <span className="desk-teacher">
                    <span className="desk-teacher__avatar" aria-hidden="true">
                      {initialsOf(session.ownerName)}
                    </span>
                    <span className="desk-teacher__name">
                      {session.ownerName}
                    </span>
                  </span>
                </td>
                <td>
                  <span className="desk-format">
                    <Video size={13} aria-hidden="true" />
                    {session.location || t(formatLabel[session.format])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="desk-empty">
          <p>{t("No upcoming sessions yet.")}</p>
          <Link href="/sessions" className="portal-inline-link">
            {t("Plan a study session")}
          </Link>
        </div>
      )}
    </section>
  );
}
