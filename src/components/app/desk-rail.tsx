"use client";

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  StickyNote,
  UserRound,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudyBuddyLogo } from "@/components/study-buddy-logo";
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
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/groups", label: "Study groups", icon: BookOpen, count: "tasks" },
  { href: "/discover", label: "Find partner", icon: Compass },
  {
    href: "/sessions",
    label: "Schedule",
    icon: CalendarDays,
    count: "sessions",
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageCircle,
    count: "messages",
  },
  { href: "/materials", label: "Materials", icon: StickyNote },
];

const secondaryLinks: RailLink[] = [
  { href: "/progress", label: "Study goals", icon: BarChart3 },
  { href: "/notes", label: "Notes", icon: StickyNote, count: "notes" },
  { href: "/my-profile", label: "My profile", icon: UserRound },
  { href: "/settings/profile", label: "Settings", icon: Settings },
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
    return pathname === href || pathname.startsWith(`${href}/`);
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
        <Link
          href="/dashboard"
          className="desk-rail__brand-link"
          onClick={onClose}
          aria-label={t("Home")}
        >
          <StudyBuddyLogo />
          <span className="desk-rail__wordmark">
            Study
            <br />
            Buddy
          </span>
        </Link>
        <span className="desk-rail__edition">{t("Campus edition")}</span>
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
