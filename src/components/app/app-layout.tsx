import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DeskRail,
  useDeskRail,
  type DeskCounts,
} from "@/components/app/desk-rail";
import { DeskTopbar, type DeskSearchEntry } from "@/components/app/desk-topbar";
import { authenticatedApiJson, ApiRequestError } from "@/lib/api-client";
import type { DashboardData, StudentProfile } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";
import { loadNotes } from "@/lib/study-notes";
import { LoaderCircle } from "lucide-react";

export type DeskContext = {
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
  counts: DeskCounts;
};

export function AppLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const rail = useDeskRail();

  const loadProfile = useCallback(async () => {
    try {
      const data = await authenticatedApiJson<StudentProfile>("profile");
      setProfile(data);
      setError("");
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && loadError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      if (loadError instanceof ApiRequestError && loadError.status === 404) {
        navigate("/onboarding", { replace: true });
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Unable to load your student profile."),
      );
    }
  }, [navigate, t]);

  useEffect(() => {
    void Promise.resolve().then(loadProfile);
  }, [loadProfile]);
  // Dashboard counts power the sidebar badges; a failure here never blocks the shell.
  useEffect(() => {
    let cancelled = false;
    authenticatedApiJson<DashboardData>("dashboard")
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch(() => {
        if (!cancelled) setDashboard(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notesCount = useMemo(
    () => (profile ? loadNotes(profile.full_name ?? "").length : 0),
    [profile],
  );

  const counts = useMemo<DeskCounts>(
    () => ({
      sessions: dashboard?.upcoming_sessions.length ?? 0,
      tasks: dashboard ? dashboard.study_groups.length : 0,
      messages:
        dashboard?.recent_conversations.reduce(
          (total, conversation) => total + conversation.unread_count,
          0,
        ) ?? 0,
      notes: notesCount,
    }),
    [dashboard, notesCount],
  );

  const searchEntries = useMemo<DeskSearchEntry[]>(() => {
    const entries: DeskSearchEntry[] = [
      {
        id: "page-dashboard",
        label: t("Dashboard"),
        meta: t("Overview"),
        href: "/dashboard",
        kind: "page",
      },
      {
        id: "page-sessions",
        label: t("Schedule"),
        meta: t("Study sessions"),
        href: "/sessions",
        kind: "page",
      },
      {
        id: "page-groups",
        label: t("Tasks"),
        meta: t("Study groups"),
        href: "/groups",
        kind: "page",
      },
      {
        id: "page-progress",
        label: t("Tests"),
        meta: t("Study progress"),
        href: "/progress",
        kind: "page",
      },
      {
        id: "page-discover",
        label: t("Reports"),
        meta: t("Discover students"),
        href: "/discover",
        kind: "page",
      },
      {
        id: "page-messages",
        label: t("Chat"),
        meta: t("Messages"),
        href: "/messages",
        kind: "page",
      },
      {
        id: "page-notes",
        label: t("Notes"),
        meta: t("Your study notes"),
        href: "/notes",
        kind: "page",
      },
      {
        id: "page-profile",
        label: t("Settings"),
        meta: t("Your profile"),
        href: "/my-profile",
        kind: "page",
      },
    ];

    dashboard?.upcoming_sessions.forEach((session) => {
      entries.push({
        id: `session-${session.id}`,
        label: session.subject || session.topic,
        meta: t("Study session"),
        href: "/sessions",
        kind: "session",
      });
    });

    dashboard?.study_groups.forEach((group) => {
      entries.push({
        id: `group-${group.id}`,
        label: group.name,
        meta: t("{count} members", { count: group.member_count }),
        href: `/groups/${group.id}`,
        kind: "group",
      });
    });

    return entries;
  }, [dashboard, t]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p
          role="alert"
          className="border border-destructive/30 bg-card p-5 text-sm text-destructive"
        >
          {error}
        </p>
      </main>
    );
  }
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        {t("Loading your study space…")}
      </div>
    );
  }

  const initials = (profile.full_name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const context: DeskContext = { profile, setProfile, counts };

  async function handleSignOut() {
    try {
      await rail.signOut();
    } catch {
      toast.error(t("We couldn't sign you out. Please try again."));
    }
  }

  return (
    <div className="desk-shell">
      <DeskRail
        open={rail.open}
        counts={counts}
        signingOut={rail.signingOut}
        onClose={rail.close}
        onSignOut={() => void handleSignOut()}
      />
      {rail.open && (
        <button
          type="button"
          className="desk-scrim"
          aria-label={t("Close menu")}
          onClick={rail.close}
        />
      )}

      <div className="desk-main">
        <DeskTopbar
          fullName={profile.full_name ?? ""}
          university={profile.university_name ?? ""}
          initials={initials}
          entries={searchEntries}
          onToggleRail={rail.toggle}
          onSignOut={() => void handleSignOut()}
          signingOut={rail.signingOut}
        />
        <div className="desk-body">
          <Outlet context={context} />
        </div>
      </div>
    </div>
  );
}
