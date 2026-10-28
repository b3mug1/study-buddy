"use client";

import Link from "@/components/navigation/link";
import { BookOpenCheck, CalendarDays, UsersRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  return (
    <main className="auth-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Link href="/" className="brand-link brand-link--logo" aria-label="Study Buddy">
          <span className="brand-logo-crop" aria-hidden="true">
            <img src="/study-buddy-logo.png" alt="" />
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <section className="mx-auto w-full max-w-md py-6">
          <p className="academic-kicker">{t(eyebrow)}</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
            {t(title)}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            {t(description)}
          </p>
          <div className="mt-8 border border-border bg-card p-6 sm:p-8">
            {children}
          </div>
        </section>

        <aside className="auth-showcase hidden flex-col justify-center lg:flex">
          <p className="academic-kicker">{t("University study community")}</p>
          <h2 className="mt-4 max-w-sm text-4xl leading-tight">
            {t("Study with intention.")}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
            {t("A thoughtful space for university students")}
          </p>
          <ol className="mt-9 border-t border-border">
            <li className="auth-showcase__step">
              <span>01</span>
              <UsersRound size={18} aria-hidden="true" />
              <p>{t("Meet students in your courses")}</p>
            </li>
            <li className="auth-showcase__step">
              <span>02</span>
              <CalendarDays size={18} aria-hidden="true" />
              <p>{t("Plan regular study sessions")}</p>
            </li>
            <li className="auth-showcase__step">
              <span>03</span>
              <BookOpenCheck size={18} aria-hidden="true" />
              <p>{t("Build steady learning habits")}</p>
            </li>
          </ol>
        </aside>
      </div>
    </main>
  );
}
