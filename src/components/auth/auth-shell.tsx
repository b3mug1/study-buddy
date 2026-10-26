import Link from "next/link";
import { BookOpenCheck, GraduationCap, Sparkles, Users, CalendarCheck, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* Ambient background glows */}
      <div className="ambient-glow -top-40 left-1/4 h-[32rem] w-[42rem] bg-indigo-500/15 dark:bg-indigo-500/20" />
      <div className="ambient-glow -bottom-32 right-10 h-[28rem] w-[36rem] bg-violet-500/15 dark:bg-violet-600/20" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
            <BookOpenCheck size={20} aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight">Study<span className="text-indigo-600 dark:text-indigo-400">Buddy</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl items-center gap-10 px-6 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Form Column */}
        <section className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Sparkles size={12} className="text-indigo-500" aria-hidden="true" />
              {eyebrow}
            </span>
            <h1 className="mt-3.5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-slate-950/5 sm:p-8 dark:shadow-black/40">
            {children}
          </div>
        </section>

        {/* Hero Illustration Column */}
        <aside className="relative hidden min-h-[36rem] overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 p-10 text-white shadow-2xl lg:flex lg:flex-col lg:justify-between dark:from-slate-900/90 dark:via-indigo-950/70 dark:to-slate-950">
          {/* Internal gradients */}
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 size-80 rounded-full bg-violet-600/35 blur-3xl" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-indigo-100 backdrop-blur-md">
              <GraduationCap size={15} className="text-indigo-300" aria-hidden="true" />
              University Study Community
            </span>

            <h2 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight text-white">
              Connect with classmates. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200">
                Study better together.
              </span>
            </h2>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-100/80 sm:text-base">
              Match with peers in your courses based on schedule compatibility, study format, and shared academic goals.
            </p>

            {/* Feature Cards Showcase */}
            <div className="mt-8 grid gap-3">
              <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.1]">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Users size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Smart Academic Matching</p>
                  <p className="text-[11px] text-indigo-200/70">Deterministic scoring across subjects, hours, and goals</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.1]">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-violet-300">
                  <CalendarCheck size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Collaborative Study Sessions</p>
                  <p className="text-[11px] text-indigo-200/70">Coordinate recurring weekly study sprints without hassle</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md transition-all hover:bg-white/[0.1]">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-500/20 text-cyan-300">
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Safe & Student-Only</p>
                  <p className="text-[11px] text-indigo-200/70">Verified profiles and private end-to-end messaging</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <p className="text-xs italic text-indigo-100/90">
              &ldquo;Finding a study buddy in Advanced Algorithms helped me stay disciplined and turn an average grade into an A.&rdquo;
            </p>
            <p className="mt-2 text-[11px] font-semibold text-indigo-200">
              — Computer Science Student, Astana IT University
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
