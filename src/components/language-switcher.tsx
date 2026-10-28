"use client";

import { useI18n, type Locale } from "@/lib/i18n";

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "ru", label: "Русский" },
  { value: "kk", label: "Қазақша" },
  { value: "en", label: "English" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {!compact && <span>{t("Interface language")}</span>}
      <select
        aria-label={t("Interface language")}
        className="min-h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
