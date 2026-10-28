"use client";

import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";

const primaryLink = {
  href: "/dashboard",
  label: "Overview",
  icon: LayoutDashboard,
};

const navigationSections = [
  {
    label: "Learning",
    links: [
      { href: "/sessions", label: "Study sessions", icon: CalendarDays },
      { href: "/progress", label: "Study progress", icon: TrendingUp },
    ],
  },
  {
    label: "Community",
    links: [
      { href: "/discover", label: "Discover", icon: Compass },
      { href: "/connections", label: "Connections", icon: UserRoundPlus },
      { href: "/groups", label: "Study groups", icon: UsersRound },
      { href: "/messages", label: "Messages", icon: MessageCircle },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/safety", label: "Community safety", icon: ShieldCheck },
      { href: "/my-profile", label: "My profile", icon: BookOpenCheck },
    ],
  },
] as const;

export function AppNav({
  fullName,
  university,
}: {
  fullName: string;
  university: string;
}) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const { t } = useI18n();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const initials = (fullName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    if (!openMenu) return;
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      if (!response.ok)
        throw new Error("We couldn't sign you out. Please try again.");
    } catch (error) {
      setSigningOut(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't sign you out. Please try again.",
      );
      return;
    }
    navigate("/login", { replace: true });
  }

  function isActive(href: string) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === "/my-profile" && pathname.startsWith("/settings"))
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <nav
        ref={navRef}
        aria-label={t("Dashboard navigation")}
        className="mx-auto flex max-w-[88rem] items-center gap-3 px-4 py-2.5 sm:px-6"
      >
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5"
          onClick={() => setOpenMenu(null)}
        >
          <span className="brand-emblem" aria-hidden="true">
            SB
          </span>
          <span className="brand-name hidden sm:block">Study Buddy</span>
        </Link>

        <div className="mx-2 hidden h-6 w-px shrink-0 bg-border xl:block" />

        <ul className="hidden flex-1 items-center gap-0.5 xl:flex">
          <li>
            <Link
              href={primaryLink.href}
              aria-current={isActive(primaryLink.href) ? "page" : undefined}
              className="app-nav__link"
            >
              <primaryLink.icon size={16} aria-hidden="true" />
              {t(primaryLink.label)}
            </Link>
          </li>
          {navigationSections.map((section) => {
            const sectionActive = section.links.some((link) =>
              isActive(link.href),
            );
            const isOpen = openMenu === section.label;
            return (
              <li key={section.label} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenMenu(isOpen ? null : section.label)}
                  className={`app-nav__trigger ${
                    sectionActive ? "app-nav__trigger--active" : ""
                  }`}
                >
                  {t(section.label)}
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div
                    role="group"
                    aria-label={t(section.label)}
                    className="app-nav__menu absolute left-0 top-[calc(100%+0.4rem)]"
                  >
                    {section.links.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpenMenu(null)}
                        aria-current={isActive(href) ? "page" : undefined}
                        className="app-nav__link"
                      >
                        <Icon size={16} aria-hidden="true" />
                        {t(label)}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="hidden xl:block">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />
          <div className="hidden h-8 items-center gap-2.5 border-l border-border pl-2.5 md:flex">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sharp)] bg-accent text-xs font-bold text-accent-foreground">
              {initials || "SB"}
            </span>
            <span className="hidden min-w-0 leading-tight lg:block">
              <span className="block max-w-40 truncate text-xs font-semibold text-foreground">
                {fullName}
              </span>
              <span className="block max-w-40 truncate text-[11px] text-muted-foreground">
                {university}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-label={t(signingOut ? "Signing out..." : "Sign out")}
            className="grid size-9 place-items-center rounded-[var(--radius-sharp)] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t(mobileMenuOpen ? "Close menu" : "Open menu")}
            aria-expanded={mobileMenuOpen}
            aria-controls="app-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid size-9 place-items-center rounded-[var(--radius-sharp)] border border-border text-foreground xl:hidden"
          >
            {mobileMenuOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      <div
        id="app-mobile-navigation"
        hidden={!mobileMenuOpen}
        className="max-h-[calc(100vh-4.5rem)] overflow-y-auto border-t border-border xl:hidden"
      >
        <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-6">
          <div className="space-y-4">
            <Link
              href={primaryLink.href}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={isActive(primaryLink.href) ? "page" : undefined}
              className="app-nav__link w-full"
            >
              <primaryLink.icon size={16} aria-hidden="true" />
              {t(primaryLink.label)}
            </Link>
            {navigationSections.map((section) => (
              <div key={section.label}>
                <p className="academic-kicker mb-1.5">{t(section.label)}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {section.links.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive(href) ? "page" : undefined}
                      className="app-nav__link w-full"
                    >
                      <Icon size={16} aria-hidden="true" />
                      {t(label)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sharp)] bg-accent text-xs font-bold text-accent-foreground">
                {initials || "SB"}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {fullName}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {university}
                </span>
              </span>
            </div>
            <LanguageSwitcher compact />
          </div>
        </div>
      </div>
    </header>
  );
}
