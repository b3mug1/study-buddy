"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Compass,
  LoaderCircle,
  MapPin,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { DiscoveryPage as DiscoveryResults } from "@/lib/api-types";

const WEEKDAYS = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

export function DiscoverPage() {
  const [results, setResults] = useState<DiscoveryResults>();
  const [search, setSearch] = useState("");
  const [university, setUniversity] = useState("");
  const [subject, setSubject] = useState("");
  const [weekday, setWeekday] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "12",
    });
    if (search.trim()) params.set("search", search.trim());
    if (university.trim()) params.set("university", university.trim());
    if (subject.trim()) params.set("subject", subject.trim());
    if (weekday) params.set("weekday", weekday);
    if (format) params.set("study_format", format);

    try {
      const data = await authenticatedApiJson<DiscoveryResults>(
        `discover?${params.toString()}`,
      );
      setResults(data);
      setError("");
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Could not load student recommendations.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [format, page, search, subject, university, weekday]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function connect(studentId: string) {
    setPendingId(studentId);
    try {
      await authenticatedApiRequest("connections", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId }),
      });
      toast.success("Connection request sent.");
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Could not send the connection request.",
      );
    } finally {
      setPendingId("");
    }
  }

  return (
    <main>
      <div>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Find your study circle
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Discover students
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Explore opted-in profiles ranked by shared subjects, overlapping study
          times, goals, format, and language.
        </p>
      </div>

      <form
        className="surface mt-7 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="relative sm:col-span-2 lg:col-span-2">
          <span className="sr-only">Search students by name</span>
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            className="field-control pl-9"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filter by university</span>
          <input
            className="field-control"
            placeholder="University"
            value={university}
            onChange={(event) => setUniversity(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filter by subject</span>
          <input
            className="field-control"
            placeholder="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filter by available weekday</span>
          <select
            className="field-control"
            value={weekday}
            onChange={(event) => setWeekday(event.target.value)}
          >
            <option value="">Any day</option>
            {WEEKDAYS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by study format</span>
          <select
            className="field-control"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="">Any format</option>
            <option value="online">Online</option>
            <option value="offline">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:col-span-2 lg:col-span-1"
        >
          <Search size={16} aria-hidden="true" /> Search
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {results
            ? `${results.total} compatible student${results.total === 1 ? "" : "s"}`
            : "Finding study partners…"}
        </p>
        <Link
          href="/connections"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          My connections <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="surface h-64 animate-pulse bg-slate-100/80 dark:bg-slate-800/50"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : results?.items.length ? (
        <>
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.items.map((student) => (
              <article key={student.id} className="surface flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                    {student.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">
                      {student.full_name}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {student.major} · Year {student.year_of_study}
                    </p>
                  </div>
                  <span className="rounded-xl bg-indigo-50 px-2.5 py-1.5 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                    {student.compatibility}%
                  </span>
                </div>

                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin size={14} aria-hidden="true" />
                  <span className="truncate">{student.university_name}</span>
                </p>
                {student.bio && (
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                    {student.bio}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <BookOpen size={14} aria-hidden="true" />
                  Shared subjects
                </div>
                <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
                  {student.shared_subjects.length ? (
                    student.shared_subjects.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No shared subjects yet
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <CalendarDays
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {student.availability_days.length
                      ? `Available ${student.availability_days
                          .map(
                            (day) =>
                              WEEKDAYS.find(
                                ([value]) => Number(value) === day,
                              )?.[1],
                          )
                          .filter(Boolean)
                          .join(", ")}`
                      : "Availability not listed"}
                    {" · "}
                    {student.study_format}
                  </span>
                </div>

                <ul className="mt-3 space-y-1">
                  {student.explanation.slice(0, 3).map((reason) => (
                    <li
                      key={reason}
                      className="text-xs leading-5 text-slate-500 dark:text-slate-400"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex gap-2 border-t border-border pt-4">
                  <Link
                    href={`/profile/${student.id}`}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    <UsersRound size={16} aria-hidden="true" /> View profile
                  </Link>
                  {student.connection_status === "accepted" ? (
                    <span className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Connected
                    </span>
                  ) : student.connection_status === "pending" ? (
                    <Link
                      href="/connections"
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-muted px-3 text-sm font-semibold text-muted-foreground"
                    >
                      {student.connection_direction === "incoming"
                        ? "Respond"
                        : "Request sent"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingId === student.id}
                      onClick={() => void connect(student.id)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {pendingId === student.id ? (
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
              </article>
            ))}
          </section>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {results.page}
            </span>
            <button
              type="button"
              disabled={!results.has_more || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      ) : !error ? (
        <div className="surface mt-5 flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <Compass size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">
            No students match those filters
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Try a broader search, or invite classmates to complete their own
            discovery profiles.
          </p>
        </div>
      ) : null}
    </main>
  );
}
