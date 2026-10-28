"use client";

import Link from "@/components/navigation/link";
import { BookOpenCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";

export function OnboardingContent({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-[var(--radius-sharp)] border border-border bg-card text-primary">
            <BookOpenCheck size={19} aria-hidden="true" />
          </span>
          Study Buddy
        </Link>
        <LanguageSwitcher compact />
      </header>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[0.72fr_1fr] lg:pt-14">
        <section className="max-w-md">
          <p className="academic-kicker">{t("Your student profile")}</p>
          <h1 className="mt-3 text-4xl leading-tight">
            {t("Let’s make this semester more connected.")}
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t(
              "A few details help us shape Study Buddy around how you learn. You can change anything later.",
            )}
          </p>
          <div className="mt-8 space-y-4 border-t border-border pt-5 text-sm text-muted-foreground">
            <p>
              {t(
                "Your subjects and goals help other students find shared interests.",
              )}
            </p>
            <p>
              {t(
                "Your availability helps make future study matches more practical.",
              )}
            </p>
            <p>{t("Your profile visibility stays under your control.")}</p>
          </div>
        </section>
        <section className="surface mx-auto w-full max-w-2xl p-5 sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
