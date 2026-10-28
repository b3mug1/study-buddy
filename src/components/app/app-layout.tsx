import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { AppNav } from "@/components/app/app-nav";
import { authenticatedApiJson, ApiRequestError } from "@/lib/api-client";
import type { StudentProfile } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";
import { LoaderCircle } from "lucide-react";

export function AppLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        fullName={profile.full_name ?? ""}
        university={profile.university_name ?? ""}
      />
      <div className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 md:py-10">
          <Outlet context={{ profile, setProfile }} />
        </div>
      </div>
    </div>
  );
}
