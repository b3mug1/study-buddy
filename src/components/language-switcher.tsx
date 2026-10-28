"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";

const localeOptions: Array<{
  value: Locale;
  label: string;
  short: string;
  hint: string;
}> = [
  { value: "ru", label: "Русский", short: "RU", hint: "Russian" },
  { value: "kk", label: "Қазақша", short: "KZ", hint: "Kazakh" },
  { value: "en", label: "English", short: "EN", hint: "English" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const active = localeOptions.find((option) => option.value === locale);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(value: Locale) {
    setLocale(value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="lang-switcher">
      {!compact && (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {t("Interface language")}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${t("Interface language")}: ${active?.label ?? ""}`}
          onClick={() => setOpen((value) => !value)}
          className={`lang-switcher__trigger ${open ? "lang-switcher__trigger--open" : ""}`}
        >
          <Globe size={15} aria-hidden="true" className="text-primary" />
          <span className="lang-switcher__short">{active?.short}</span>
          <span className="lang-switcher__label">{active?.label}</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label={t("Interface language")}
            className="lang-switcher__menu"
          >
            {localeOptions.map((option) => {
              const selected = option.value === locale;
              return (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(option.value)}
                    className={`lang-switcher__option ${
                      selected ? "lang-switcher__option--active" : ""
                    }`}
                  >
                    <span className="lang-switcher__badge">{option.short}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                    {selected && (
                      <Check
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-primary"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
