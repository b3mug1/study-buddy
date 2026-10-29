"use client";

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  StickyNote,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";

export type DeskCounts = {
  sessions: number;
  tasks: number;
  messages: number;
  notes: number;
};

type RailLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: keyof DeskCounts;
};

const primaryLinks: RailLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/sessions",
    label: "Schedule",
    icon: CalendarDays,
    count: "sessions",
  },
  { href: "/groups", label: "Tasks", icon: ClipboardList, count: "tasks" },
  { href: "/progress", label: "Tests", icon: BarChart3 },
  { href: "/discover", label: "Reports", icon: History },
  { href: "/messages", label: "Chat", icon: MessageCircle, count: "messages" },
  { href: "/notes", label: "Notes", icon: StickyNote, count: "notes" },
];

const secondaryLinks: RailLink[] = [
  { href: "/my-profile", label: "Settings", icon: Settings },
];

export function DeskRail({
  open,
  counts,
  signingOut,
  onClose,
  onSignOut,
}: {
  open: boolean;
  counts: DeskCounts;
  signingOut: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const pathname = useLocation().pathname;

  function isActive(href: string) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === "/my-profile" && pathname.startsWith("/settings"))
    );
  }

  function renderLink({ href, label, icon: Icon, count }: RailLink) {
    const countValue = count ? counts[count] : 0;
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        aria-current={isActive(href) ? "page" : undefined}
        className="desk-nav-link"
      >
        <span className="desk-nav-link__icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="desk-nav-link__label">{t(label)}</span>
        {count && countValue > 0 && (
          <span className="desk-nav-link__count">{countValue}</span>
        )}
      </Link>
    );
  }

  return (
    <aside
      id="study-desk-rail"
      className={`desk-rail ${open ? "desk-rail--open" : ""}`}
      aria-label={t("Dashboard navigation")}
    >
      <div className="desk-rail__brand">
        <span className="desk-rail__mark" aria-hidden="true">
          <BookOpenCheck size={18} />
        </span>
        <span className="desk-rail__wordmark">Study Buddy</span>
      </div>

      <nav className="desk-rail__nav">
        {primaryLinks.map(renderLink)}
        <div className="desk-rail__group">{secondaryLinks.map(renderLink)}</div>
      </nav>

      <div className="desk-rail__footer">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="desk-rail__signout"
        >
          <LogOut size={18} aria-hidden="true" />
          {t(signingOut ? "Signing out..." : "Log out")}
        </button>
        <div className="desk-rail__tools">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** Closes the rail when the viewport grows past the desktop breakpoint. */
export function useDeskRail() {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const mounted = useRef(true);

  // The rail auto-closes on navigation by comparing the route it was opened on.
  const open = openFor === pathname;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenFor(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      if (!response.ok) throw new Error("logout failed");
    } catch {
      if (mounted.current) setSigningOut(false);
      return;
    }
    navigate("/login", { replace: true });
  }

  return {
    open,
    signingOut,
    toggle: () => setOpenFor((value) => (value === pathname ? null : pathname)),
    close: () => setOpenFor(null),
    signOut,
  };
}
