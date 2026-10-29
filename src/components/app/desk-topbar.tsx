"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  EllipsisVertical,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  StickyNote,
  UserRound,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useI18n } from "@/lib/i18n";

export type DeskSearchEntry = {
  id: string;
  label: string;
  meta: string;
  href: string;
  kind: "page" | "session" | "group" | "note";
};

export function DeskSearch({
  entries,
  placeholder,
  hint,
  emptyLabel,
}: {
  entries: DeskSearchEntry[];
  placeholder: string;
  hint: string;
  emptyLabel: string;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const indexed = useMemo<DeskSearchEntry[]>(
    () =>
      entries.map((entry, index) => ({
        ...entry,
        id: `${entry.kind}-${index}-${entry.href}`,
      })),
    [entries],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? indexed.filter((entry) =>
          `${entry.label} ${entry.meta}`.toLowerCase().includes(needle),
        )
      : indexed.filter((entry) => entry.kind === "page");
    return pool.slice(0, 8);
  }, [indexed, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function go(entry: DeskSearchEntry) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    navigate(entry.href);
  }

  return (
    <div
      ref={containerRef}
      className="desk-search"
      data-open={open ? "true" : "false"}
      role="search"
    >
      <Search className="desk-search__icon" size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
          if (event.key === "Enter" && results[0]) go(results[0]);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={open}
        aria-controls="desk-search-results"
        className="desk-search__input"
      />
      {open && (
        <div
          id="desk-search-results"
          className="desk-search__results"
          role="listbox"
          aria-label={hint}
        >
          {results.length ? (
            results.map((entry) => {
              const Icon = kindIcons[entry.kind];
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="desk-search__item"
                  onClick={() => go(entry)}
                >
                  <span className="desk-search__icon-badge" aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {entry.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.meta}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="desk-search__empty">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function DeskTopbar({
  fullName,
  university,
  initials,
  entries,
  onToggleRail,
  onSignOut,
  signingOut,
}: {
  fullName: string;
  university: string;
  initials: string;
  entries: DeskSearchEntry[];
  onToggleRail: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="desk-topbar">
      <button
        type="button"
        onClick={onToggleRail}
        aria-label={t("Open menu")}
        aria-controls="study-desk-rail"
        className="desk-icon-button desk-rail-toggle"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <DeskSearch
        entries={entries}
        placeholder={t("Search your study space")}
        hint={t("Search results")}
        emptyLabel={t("No matching pages, sessions, or notes.")}
      />

      <div className="desk-topbar__spacer" />

      <Link
        href="/groups"
        className="desk-create"
        aria-label={t("Create a study group")}
      >
        <span className="desk-create__icon" aria-hidden="true">
          <Plus size={14} />
        </span>
        <span className="desk-create__label">{t("Create")}</span>
      </Link>

      <div ref={accountRef} className="desk-account">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="desk-account__trigger"
        >
          <span className="desk-account__avatar" aria-hidden="true">
            {initials || "SB"}
          </span>
          <span className="desk-account__text">
            <span className="desk-account__name">{fullName}</span>
            <span className="desk-account__meta">{university}</span>
          </span>
          <ChevronDown
            size={15}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div className="desk-account__menu" role="menu">
            <div className="desk-account__header">
              <p className="truncate text-sm font-semibold text-foreground">
                {fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {university}
              </p>
            </div>
            <div className="desk-account__divider" />
            <button
              type="button"
              role="menuitem"
              className="desk-account__option"
              onClick={() => {
                setMenuOpen(false);
                navigate("/my-profile");
              }}
            >
              <UserRound size={16} aria-hidden="true" />
              {t("My profile")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="desk-account__option"
              onClick={() => {
                setMenuOpen(false);
                navigate("/my-profile");
              }}
            >
              <Settings size={16} aria-hidden="true" />
              {t("Settings")}
            </button>
            <div className="desk-account__divider" />
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              className="desk-account__option desk-account__option--danger"
              onClick={onSignOut}
            >
              <LogOut size={16} aria-hidden="true" />
              {t(signingOut ? "Signing out..." : "Log out")}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={t("Open menu")}
        onClick={onToggleRail}
        className="desk-icon-button desk-icon-button--plain desk-rail-toggle"
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>
    </header>
  );
}

const kindIcons = {
  page: LayoutDashboard,
  session: CalendarDays,
  group: BookOpen,
  note: StickyNote,
} as const;
