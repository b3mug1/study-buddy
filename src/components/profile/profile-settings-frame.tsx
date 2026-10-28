"use client";

import Link from "@/components/navigation/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ProfileSettingsFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t("Back to overview")}
      </Link>
      <div className="mt-6">
        <p className="academic-kicker">{t("Your account")}</p>
        <h1 className="mt-2 text-4xl">{t("Edit your study profile")}</h1>
        <p className="mt-3 text-muted-foreground">
          {t("Keep your profile and study preferences up to date.")}
        </p>
      </div>
      <div className="surface mt-7 p-5 sm:p-8">{children}</div>
      <div className="mt-5 flex gap-3 border border-border bg-card p-4 text-sm">
        <span className="grid size-9 shrink-0 place-items-center border border-border bg-muted text-primary">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">
            {t("Your information stays in your hands.")}
          </p>
          <p className="mt-1 leading-5 text-muted-foreground">
            {t(
              "Profile and academic preference data are protected by database row-level security. Your discovery visibility setting is enforced by the API and database.",
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
