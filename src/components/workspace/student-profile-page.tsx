"use client";

import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Send,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { DiscoverableStudent } from "@/lib/api-types";
import { SafetyActions } from "@/components/workspace/safety-actions";

const BREAKDOWN_LABELS = [
  ["subjects", "Shared subjects", "40%"],
  ["availability", "Availability", "30%"],
  ["learning_goals", "Learning goals", "15%"],
  ["study_format", "Study format", "10%"],
  ["language", "Language", "5%"],
] as const;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function StudentProfilePage({ studentId }: { studentId: string }) {
  const { t } = useI18n();
  const [student, setStudent] = useState<DiscoverableStudent>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await authenticatedApiJson<DiscoverableStudent>(
        `students/${studentId}`,
      );
      setStudent(profile);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this student profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function connect() {
    if (!student) return;
    setConnecting(true);
    try {
      await authenticatedApiRequest("connections", {
        method: "POST",
        body: JSON.stringify({ student_id: student.id }),
      });
      toast.success(t("Connection request sent."));
      await load();
    } catch (connectError) {
      toast.error(
        connectError instanceof Error
          ? connectError.message
          : "Could not send the connection request.",
      );
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="surface h-72 animate-pulse bg-muted/60"
        aria-label={t("Loading student profile")}
      />
    );
  }
  if (!student || error) {
    return (
      <main>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline "
        >
          <ArrowLeft size={16} aria-hidden="true" /> {t("Back to discovery")}
        </Link>
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error || "This profile is unavailable."}
        </p>
      </main>
    );
  }

  const initials = student.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const availableDays = student.availability_days
    .map((day) => WEEKDAYS[day])
    .filter(Boolean)
    .map((day) => t(day))
    .join(", ");

  return (
    <main className="mx-auto max-w-4xl">
      <Link
        href="/discover"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t("Back to discovery")}
      </Link>
      <section className="surface mt-5 overflow-hidden">
        <div className="h-28 bg-[var(--brand-ink)]" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="grid size-20 place-items-center rounded-[var(--radius)] border-4 border-card bg-accent text-xl font-bold text-accent-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {student.full_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {student.major} ·{" "}
                {t("Year {year}", { year: student.year_of_study })}
              </p>
            </div>
            <span className="mb-1 inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-bold text-accent-foreground dark:bg-accent ">
              {t("{percent}% compatible", { percent: student.compatibility })}
            </span>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={16} aria-hidden="true" /> {student.university_name}
          </p>
          {student.bio && (
            <p className="mt-5 max-w-3xl whitespace-pre-wrap leading-7 text-muted-foreground">
              {student.bio}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {student.connection_status === "accepted" ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground dark:bg-accent ">
                {t("Connected")}
              </span>
            ) : student.connection_status === "pending" ? (
              <Link
                href="/connections"
                className="inline-flex h-10 items-center rounded-md bg-muted px-4 text-sm font-semibold text-muted-foreground"
              >
                {student.connection_direction === "incoming"
                  ? t("Respond to request")
                  : t("Request sent")}
              </Link>
            ) : student.connection_status === "declined" &&
              student.connection_direction === "outgoing" ? (
              <span className="inline-flex h-10 items-center rounded-md bg-muted px-4 text-sm font-semibold text-muted-foreground">
                {t("Request declined")}
              </span>
            ) : (
              <button
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {connecting ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send size={15} aria-hidden="true" />
                )}
                {t("Connect")}
              </button>
            )}
            {!(
              student.connection_status === "pending" &&
              student.connection_direction === "incoming"
            ) &&
              !(
                student.connection_status === "declined" &&
                student.connection_direction === "outgoing"
              ) && (
                <Link
                  href={`/messages/new/${student.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold transition hover:bg-muted"
                >
                  <MessageSquareText size={16} aria-hidden="true" />
                  {t("Send a message")}
                </Link>
              )}
          </div>
        </div>
      </section>

      <SafetyActions studentId={student.id} studentName={student.full_name} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" aria-hidden="true" />
            <h2 className="font-semibold">{t("Study interests")}</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {student.subjects.length ? (
              student.subjects.map((subject) => (
                <span
                  key={subject}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${student.shared_subjects.some((shared) => shared.toLowerCase() === subject.toLowerCase()) ? "bg-accent text-accent-foreground dark:bg-accent " : "bg-muted text-muted-foreground"}`}
                >
                  {subject}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("No subjects are listed.")}
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-5">
            <CalendarDays
              size={18}
              className="text-primary"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold">
              {t("Availability and format")}
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {student.availability_days.length
              ? t("Available {days}", { days: availableDays })
              : t("Availability not listed")}{" "}
            · {t(student.preferred_hours)}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm capitalize text-muted-foreground">
            <GraduationCap size={16} aria-hidden="true" />{" "}
            {t("{format} study", { format: t(student.study_format) })}
          </p>
        </section>

        <section className="surface p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-primary">
              {t("Why this could work")}
            </p>
            <h2 className="mt-1 font-semibold">
              {t("Compatibility breakdown")}
            </h2>
          </div>
          <ul className="mt-4 space-y-4">
            {BREAKDOWN_LABELS.map(([key, label, weight]) => {
              const score = student.breakdown[key];
              return (
                <li key={key}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">
                      {t(label)}{" "}
                      <span className="text-muted-foreground">
                        · {weight} {t("weight")}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{score}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <ul className="mt-5 space-y-2 border-t border-border pt-4">
            {student.explanation.map((reason) => (
              <li
                key={reason}
                className="text-sm leading-5 text-muted-foreground"
              >
                {reason}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
