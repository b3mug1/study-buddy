"use client";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { DiscoverableStudent } from "@/lib/api-types";

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
      toast.success("Connection request sent.");
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
        aria-label="Loading student profile"
      />
    );
  }
  if (!student || error) {
    return (
      <main>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to discovery
        </Link>
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
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

  return (
    <main className="mx-auto max-w-4xl">
      <Link
        href="/discover"
        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to discovery
      </Link>
      <section className="surface mt-5 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-indigo-600 to-violet-600" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="grid size-20 place-items-center rounded-3xl border-4 border-card bg-violet-100 text-xl font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
              {initials}
            </span>
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {student.full_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {student.major} · Year {student.year_of_study}
              </p>
            </div>
            <span className="mb-1 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
              {student.compatibility}% compatible
            </span>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={16} aria-hidden="true" /> {student.university_name}
          </p>
          {student.bio && (
            <p className="mt-5 max-w-3xl whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
              {student.bio}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {student.connection_status === "accepted" ? (
              <Link
                href="/messages"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                Connected · Open messages
              </Link>
            ) : student.connection_status === "pending" ? (
              <Link
                href="/connections"
                className="inline-flex h-10 items-center rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground"
              >
                {student.connection_direction === "incoming"
                  ? "Respond to request"
                  : "Request sent"}
              </Link>
            ) : (
              <button
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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
                Connect
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <BookOpen
              size={18}
              className="text-indigo-600 dark:text-indigo-400"
              aria-hidden="true"
            />
            <h2 className="font-semibold">Study interests</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {student.subjects.length ? (
              student.subjects.map((subject) => (
                <span
                  key={subject}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${student.shared_subjects.some((shared) => shared.toLowerCase() === subject.toLowerCase()) ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "bg-muted text-muted-foreground"}`}
                >
                  {subject}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No subjects are listed.
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-5">
            <CalendarDays
              size={18}
              className="text-indigo-600 dark:text-indigo-400"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold">Availability and format</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {student.availability_days.length
              ? `Available ${student.availability_days.map((day) => WEEKDAYS[day]).join(", ")}`
              : "Availability not listed"}{" "}
            · {student.preferred_hours}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm capitalize text-muted-foreground">
            <GraduationCap size={16} aria-hidden="true" />{" "}
            {student.study_format} study
          </p>
        </section>

        <section className="surface p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Why this could work
            </p>
            <h2 className="mt-1 font-semibold">Compatibility breakdown</h2>
          </div>
          <ul className="mt-4 space-y-4">
            {BREAKDOWN_LABELS.map(([key, label, weight]) => {
              const score = student.breakdown[key];
              return (
                <li key={key}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">
                      {label}{" "}
                      <span className="text-muted-foreground">
                        · {weight} weight
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{score}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-indigo-500"
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
