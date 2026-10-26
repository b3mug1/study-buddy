"use client";

import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  Compass,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  UsersRound,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

const availableLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/connections", label: "Connections", icon: UserRoundPlus },
  { href: "/groups", label: "Study groups", icon: UsersRound },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/sessions", label: "Study sessions", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/profile", label: "My profile", icon: BookOpenCheck },
];

export function AppSidebar({
  fullName,
  university,
}: {
  fullName: string;
  university: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      if (!response.ok) {
        throw new Error("We couldn't sign you out. Please try again.");
      }
    } catch (error) {
      setSigningOut(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't sign you out. Please try again.",
      );
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/90 backdrop-blur-md px-4 py-6 md:flex md:flex-col">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="mb-8 flex items-center gap-2.5 px-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
            <BookOpenCheck size={18} aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight">Study<span className="text-indigo-600 dark:text-indigo-400">Buddy</span></span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-1" aria-label="Dashboard navigation">
          <p className="mb-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Workspace
          </p>
          {availableLinks.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/settings/profile" &&
                pathname.startsWith("/settings"));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  active
                    ? "bg-indigo-500/10 text-indigo-600 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={17} className={active ? "text-indigo-600 dark:text-indigo-400" : ""} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/50">
            <div className="relative">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                {initials || "SB"}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {university}
              </p>
            </div>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
          >
            <LogOut size={15} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md">
              <BookOpenCheck size={16} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-tight">Study<span className="text-indigo-600 dark:text-indigo-400">Buddy</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              disabled={signingOut}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav
          className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5"
          aria-label="Mobile navigation"
        >
          {availableLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                pathname === href
                  ? "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
