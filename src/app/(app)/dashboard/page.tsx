import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CircleUserRound,
  Compass,
  GraduationCap,
  MessageCircle,
  Target,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalSessionTime } from "@/components/workspace/local-session-time";
import { getApiData, requestApiFromServer } from "@/lib/api-server";
import type { DashboardData } from "@/lib/api-types";

export const metadata: Metadata = { title: "Your dashboard" };

export default async function DashboardPage() {
  const response = await requestApiFromServer("dashboard");
  if (response.status === 401) redirect("/login");
  const data = await getApiData<DashboardData>(
    response,
    "Unable to load your dashboard.",
  );
  const { profile } = data;
  const firstName = profile.full_name.trim().split(/\s+/)[0] || "there";

  return (
    <main>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-2 text-muted-foreground">
            A little progress, a few good people, a better study week.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Update your profile <ArrowRight className="ml-2" aria-hidden="true" />
        </Link>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="surface relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white sm:p-8">
          <div className="absolute -right-14 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium">
              <GraduationCap size={14} aria-hidden="true" />{" "}
              {profile.university_name}
            </span>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">
              Your study story starts here.
            </h2>
            <p className="mt-2 max-w-xl leading-6 text-indigo-100">
              You’re studying {profile.major} · Year {profile.year_of_study}.
              Your profile gives future study partners a feel for what you care
              about.
            </p>
            <Link
              href="/settings/profile"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
            >
              Complete your study profile{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article className="surface flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Profile details</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A snapshot of your saved profile
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <CircleUserRound size={20} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight">
                {data.profile_completion}%
              </span>
              <span className="pb-1 text-sm text-muted-foreground">
                filled in
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${data.profile_completion}%` }}
              />
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Add a short bio and learning goals to help others find common
            ground.
          </p>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Matched to your profile
              </p>
              <h2 className="mt-1 font-semibold">Study partners to explore</h2>
            </div>
            <Link
              href="/discover"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Discover
            </Link>
          </div>
          {data.recommended_students.length ? (
            <ul className="mt-4 space-y-2">
              {data.recommended_students.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/profile/${student.id}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 transition hover:bg-muted"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                      {student.full_name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {student.full_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.major}
                        {student.shared_subjects.length
                          ? ` · ${student.shared_subjects.slice(0, 2).join(", ")}`
                          : ""}
                      </span>
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                      {student.compatibility}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              No other opted-in student profiles are available yet.
            </p>
          )}
        </article>

        <article className="surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen
                  size={18}
                  className="text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />
                <h2 className="font-semibold">Your subjects</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                The topics you’re keen to learn with others.
              </p>
            </div>
            <Link
              href="/settings/profile"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Edit
            </Link>
          </div>
          {profile.subjects.length ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {profile.subjects.map((subject) => (
                <li
                  key={subject}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
                >
                  {subject}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
              Your saved subjects will show up here.
            </p>
          )}
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target
                size={16}
                className="text-violet-600 dark:text-violet-400"
                aria-hidden="true"
              />{" "}
              Learning goals
            </div>
            {profile.learning_goals.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.learning_goals.map((goal) => (
                  <li
                    key={goal}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {goal}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Add goals to complete your student profile.
              </p>
            )}
          </div>
        </article>

        <article className="surface p-6">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={18}
              className="text-indigo-600 dark:text-indigo-400"
              aria-hidden="true"
            />
            <h2 className="font-semibold">Study sessions</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Make space for your next focused hour.
          </p>
          {data.upcoming_sessions.length ? (
            <ul className="mt-5 space-y-2">
              {data.upcoming_sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                    <CalendarDays size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {session.subject}: {session.topic}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      <LocalSessionTime value={session.starts_at} /> ·{" "}
                      {session.study_format}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center">
              <CalendarDays
                size={20}
                className="text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold">No upcoming sessions</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Schedule a session and invite connected students.
              </p>
            </div>
          )}
          <Link
            href="/sessions"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            View study sessions <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Compass size={15} aria-hidden="true" />
            <span>
              Study format: {profile.study_format} · Group size:{" "}
              {profile.group_size}
            </span>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UsersRound
                  size={18}
                  className="text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />
                <h2 className="font-semibold">Your study groups</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Communities you’ve joined.
              </p>
            </div>
            <Link
              href="/groups"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Explore
            </Link>
          </div>
          {data.study_groups.length ? (
            <ul className="mt-4 space-y-2">
              {data.study_groups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 transition hover:bg-muted"
                  >
                    <span className="grid size-9 place-items-center rounded-lg bg-white text-violet-600 dark:bg-slate-800 dark:text-violet-300">
                      <BookOpen size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {group.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {group.subject} · {group.member_count} members
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
            <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              Join or create a study group to see it here.
            </p>
          )}
        </article>

        <article className="surface p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle
                  size={18}
                  className="text-indigo-600 dark:text-indigo-400"
                  aria-hidden="true"
                />
                <h2 className="font-semibold">Recent conversations</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep your study plans moving.
              </p>
            </div>
            <Link
              href="/messages"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Messages
            </Link>
          </div>
          {data.recent_conversations.length ? (
            <ul className="mt-4 space-y-2">
              {data.recent_conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/messages/${conversation.id}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 transition hover:bg-muted"
                  >
                    <span className="grid size-9 place-items-center rounded-lg bg-white text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                      <MessageCircle size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {conversation.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.last_message ?? "Start the conversation"}
                      </span>
                    </span>
                    {conversation.unread_count > 0 && (
                      <span className="grid size-6 place-items-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                        {conversation.unread_count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              Connect with a student or join a group to start a conversation.
            </p>
          )}
          {data.unread_notifications > 0 && (
            <Link
              href="/notifications"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Bell size={14} aria-hidden="true" /> {data.unread_notifications}{" "}
              unread notifications
            </Link>
          )}
        </article>
      </section>
    </main>
  );
}
