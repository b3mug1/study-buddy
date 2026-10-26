import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CircleCheck,
  Compass,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const highlights = [
  {
    icon: Compass,
    title: "Deterministic Matching",
    text: "Find study partners ranked strictly by shared courses (40%), compatible weekly hours (30%), and study goals (15%). No paywalled AI tricks.",
    gradient: "from-indigo-500/20 to-violet-500/10",
    border: "border-indigo-500/20",
    iconColor: "text-indigo-500",
  },
  {
    icon: CalendarDays,
    title: "Sync Study Sessions",
    text: "Schedule recurring or one-off exam prep sprints that fit both of your schedules, with local timezone sync and reminder notifications.",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    border: "border-violet-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: UsersRound,
    title: "Course Study Circles",
    text: "Join small, focused study circles built around specific university classes, share problem sets, and prepare together.",
    gradient: "from-cyan-500/20 to-blue-500/10",
    border: "border-cyan-500/20",
    iconColor: "text-cyan-500",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* Background Glows */}
      <div className="ambient-glow -top-32 left-1/2 -translate-x-1/2 h-[36rem] w-[54rem] bg-indigo-500/15 dark:bg-indigo-600/20" />
      <div className="ambient-glow top-[40rem] -left-32 h-[30rem] w-[40rem] bg-violet-500/10 dark:bg-violet-600/15" />
      <div className="ambient-glow top-[50rem] -right-32 h-[30rem] w-[40rem] bg-cyan-500/10 dark:bg-cyan-600/15" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
            <BookOpenCheck size={20} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight">Study<span className="text-indigo-600 dark:text-indigo-400">Buddy</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Get started <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-16">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-50/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-indigo-700 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-300">
            <GraduationCap size={15} className="text-indigo-500" aria-hidden="true" />
            University Collaboration Platform · 100% Free
          </div>

          <h1 className="text-balance text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Find your people. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 dark:from-indigo-400 dark:via-violet-400 dark:to-cyan-300">
              Study smarter.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            The right study partner can transform your semester. Connect with students in your courses, align your schedules, and build consistent habits together.
          </p>

          <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-7 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Find your study buddy
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-base font-semibold transition hover:bg-muted"
            >
              How matching works
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <CircleCheck size={16} className="text-emerald-500" aria-hidden="true" />
              Direct instant sign up
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CircleCheck size={16} className="text-emerald-500" aria-hidden="true" />
              Real-time WebSocket chat
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CircleCheck size={16} className="text-emerald-500" aria-hidden="true" />
              Private & student-first
            </span>
          </div>
        </div>

        {/* Hero Interactive Preview Card */}
        <div className="relative mx-auto w-full max-w-[32rem]">
          <div className="ambient-glow -right-8 -top-8 size-40 bg-violet-500/30" />
          <div className="ambient-glow -bottom-8 -left-8 size-40 bg-indigo-500/30" />

          <div className="glass-card relative rounded-3xl p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Study Match</p>
                <p className="text-base font-bold text-foreground">96% Compatibility Score</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active now
              </span>
            </div>

            {/* Match Profile Preview */}
            <div className="mt-5 space-y-3">
              {[
                {
                  initials: "BM",
                  name: "Bekzat Murat",
                  university: "Astana IT University",
                  subjects: ["Algorithms", "Web Dev", "Database Systems"],
                  score: "96%",
                  color: "bg-indigo-600 text-white",
                },
                {
                  initials: "AS",
                  name: "Aruzhan S.",
                  university: "Astana IT University",
                  subjects: ["Data Structures", "Linear Algebra"],
                  score: "92%",
                  color: "bg-violet-600 text-white",
                },
                {
                  initials: "DN",
                  name: "Daniyar N.",
                  university: "Astana IT University",
                  subjects: ["Operating Systems", "Computer Networks"],
                  score: "88%",
                  color: "bg-cyan-600 text-white",
                },
              ].map((student) => (
                <div
                  key={student.initials}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/80 p-3.5 transition-all hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-sm ${student.color}`}
                    >
                      {student.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{student.university}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {student.subjects.slice(0, 2).map((s) => (
                          <span key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{student.score}</span>
                    <p className="text-[10px] text-muted-foreground">Match</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Upcoming Session Snippet */}
            <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-50/70 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  <CalendarDays size={15} className="text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  Upcoming Study Sprint
                </div>
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Tomorrow</span>
              </div>
              <p className="mt-1.5 text-xs text-indigo-900/80 dark:text-indigo-200/80">
                Algorithms Midterm Review · 18:00 - 20:00 (Library / Online)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Highlights */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-border/80 bg-muted/40 py-24"
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Zap size={13} className="text-indigo-500" />
              Engineered for Students
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything you need to excel together.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Built specifically around university coursework, schedules, and accountability.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text, gradient, border, iconColor }, index) => (
              <article
                key={title}
                className={`relative overflow-hidden rounded-2xl border ${border} bg-card p-7 shadow-sm transition-all hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1`}
              >
                <div className={`ambient-glow -top-12 -right-12 size-32 bg-gradient-to-br ${gradient}`} />
                <div className={`grid size-12 place-items-center rounded-xl bg-muted ${iconColor}`}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Feature 0{index + 1}
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center sm:px-8">
          <div className="glass-card relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/60 to-slate-950/80 p-10 text-white shadow-2xl sm:p-14">
            <div className="ambient-glow -top-20 left-1/2 -translate-x-1/2 h-40 w-96 bg-indigo-500/30" />
            <h2 className="relative z-10 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Ready to find your university study circle?
            </h2>
            <p className="relative z-10 mt-4 text-base text-indigo-200/80">
              Create your profile in 60 seconds and start connecting with classmates today.
            </p>
            <div className="relative z-10 mt-8 flex justify-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-base font-bold text-indigo-950 shadow-xl transition-all hover:bg-indigo-50 active:scale-[0.98]"
              >
                Get started for free
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/80 bg-background/80 py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 font-bold tracking-tight text-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white text-xs">
              <BookOpenCheck size={14} />
            </span>
            StudyBuddy
          </div>
          <p className="text-xs text-muted-foreground">
            Find your people. Study smarter. Built for university student success.
          </p>
        </div>
      </footer>
    </main>
  );
}
