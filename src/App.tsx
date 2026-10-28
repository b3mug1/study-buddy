import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import { RevealController } from "@/components/motion/reveal-controller";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SplashScreen } from "@/components/motion/splash-screen";
import type { ProfileFormValues } from "@/lib/schemas/profile";
import { ApiRequestError, authenticatedApiJson } from "@/lib/api-client";
import type { StudentProfile } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";
import { LoaderCircle } from "lucide-react";

const LandingPage = lazy(() =>
  import("@/components/landing-page").then((module) => ({
    default: module.LandingPage,
  })),
);
const AuthShell = lazy(() =>
  import("@/components/auth/auth-shell").then((module) => ({
    default: module.AuthShell,
  })),
);
const AuthReturnLink = lazy(() =>
  import("@/components/auth/auth-return-link").then((module) => ({
    default: module.AuthReturnLink,
  })),
);
const LoginForm = lazy(() =>
  import("@/components/auth/auth-forms").then((module) => ({
    default: module.LoginForm,
  })),
);
const RegisterForm = lazy(() =>
  import("@/components/auth/auth-forms").then((module) => ({
    default: module.RegisterForm,
  })),
);
const ResetPasswordForm = lazy(() =>
  import("@/components/auth/auth-forms").then((module) => ({
    default: module.ResetPasswordForm,
  })),
);
const VerifyEmailForm = lazy(() =>
  import("@/components/auth/auth-forms").then((module) => ({
    default: module.VerifyEmailForm,
  })),
);
const OnboardingContent = lazy(() =>
  import("@/components/profile/onboarding-content").then((module) => ({
    default: module.OnboardingContent,
  })),
);
const ProfileSettingsFrame = lazy(() =>
  import("@/components/profile/profile-settings-frame").then((module) => ({
    default: module.ProfileSettingsFrame,
  })),
);
const ProfileWizard = lazy(() =>
  import("@/components/profile/profile-wizard").then((module) => ({
    default: module.ProfileWizard,
  })),
);
const MyProfilePage = lazy(() =>
  import("@/components/workspace/my-profile-page").then((module) => ({
    default: module.MyProfilePage,
  })),
);
const DashboardView = lazy(() =>
  import("@/components/workspace/dashboard-view").then((module) => ({
    default: module.DashboardView,
  })),
);
const DiscoverPage = lazy(() =>
  import("@/components/workspace/discover-page").then((module) => ({
    default: module.DiscoverPage,
  })),
);
const ConnectionsPage = lazy(() =>
  import("@/components/workspace/connections-page").then((module) => ({
    default: module.ConnectionsPage,
  })),
);
const GroupsPage = lazy(() =>
  import("@/components/workspace/groups-page").then((module) => ({
    default: module.GroupsPage,
  })),
);
const GroupDetailsPage = lazy(() =>
  import("@/components/workspace/groups-page").then((module) => ({
    default: module.GroupDetailsPage,
  })),
);
const MessagesPage = lazy(() =>
  import("@/components/workspace/messages-page").then((module) => ({
    default: module.MessagesPage,
  })),
);
const ConversationPage = lazy(() =>
  import("@/components/workspace/messages-page").then((module) => ({
    default: module.ConversationPage,
  })),
);
const StartConversationPage = lazy(() =>
  import("@/components/workspace/messages-page").then((module) => ({
    default: module.StartConversationPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("@/components/workspace/notifications-page").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ProgressPage = lazy(() =>
  import("@/components/workspace/progress-page").then((module) => ({
    default: module.ProgressPage,
  })),
);
const SafetyPage = lazy(() =>
  import("@/components/workspace/safety-page").then((module) => ({
    default: module.SafetyPage,
  })),
);
const SessionsPage = lazy(() =>
  import("@/components/workspace/sessions-page").then((module) => ({
    default: module.SessionsPage,
  })),
);
const StudentProfilePage = lazy(() =>
  import("@/components/workspace/student-profile-page").then((module) => ({
    default: module.StudentProfilePage,
  })),
);

function RouteLoading() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
      <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
      {t("Loading your study space…")}
    </div>
  );
}

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = pathname.startsWith("/groups/")
      ? "Study group"
      : pathname.startsWith("/messages/")
        ? "Conversation"
        : pathname.startsWith("/profile/")
          ? "Student profile"
          : ({
              "/": "Study Buddy — Find your people. Study smarter.",
              "/login": "Log in",
              "/register": "Create your account",
              "/forgot-password": "Reset your password",
              "/reset-password": "Choose a new password",
              "/auth/verify": "Verify your email",
              "/onboarding": "Set up your profile",
              "/dashboard": "Overview",
              "/my-profile": "My profile",
              "/discover": "Discover students",
              "/connections": "Connections",
              "/groups": "Study groups",
              "/messages": "Messages",
              "/sessions": "Study sessions",
              "/progress": "Study progress",
              "/notifications": "Notifications",
              "/safety": "Community safety",
              "/settings/profile": "Edit profile",
            }[pathname] ?? "Study Buddy");
    document.title = `${title}${pathname === "/" ? "" : " · Study Buddy"}`;
  }, [pathname]);
  return null;
}

function LoginRoute() {
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const error = searchParams.get("error");
  const authError =
    error === "auth-verify"
      ? "We couldn't verify that email link. Request a new verification email and try again."
      : error === "auth-not-configured"
        ? "Authentication is not configured yet. Check the API and PostgreSQL settings."
        : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up where you left off."
      description="Sign in to reconnect with your study community."
    >
      <LoginForm resetSuccess={resetSuccess} authError={authError} />
    </AuthShell>
  );
}

function RegisterRoute() {
  return (
    <AuthShell
      eyebrow="Your next semester starts here"
      title="Find your study circle."
      description="Create an account, tell us what you study, and start building better study habits together."
    >
      <RegisterForm />
    </AuthShell>
  );
}

function ForgotPasswordRoute() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Password reset is unavailable."
      description="This app does not send recovery emails. Contact the app administrator for help resetting your password."
    >
      <AuthReturnLink />
    </AuthShell>
  );
}

function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  return (
    <AuthShell
      eyebrow="One last step"
      title="Choose a new password."
      description="Use at least 8 characters and keep it somewhere safe."
    >
      <ResetPasswordForm token={searchParams.get("token") ?? ""} />
    </AuthShell>
  );
}

function VerifyEmailRoute() {
  const [searchParams] = useSearchParams();
  return (
    <AuthShell
      eyebrow="One last step"
      title="Verify your email."
      description="Confirm your university email address, then set up your Study Buddy profile."
    >
      <VerifyEmailForm token={searchParams.get("token") ?? ""} />
    </AuthShell>
  );
}

function OnboardingRoute() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "error">(
    "checking",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void authenticatedApiJson<StudentProfile>("profile")
      .then(() => {
        if (active) navigate("/dashboard", { replace: true });
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (loadError instanceof ApiRequestError && loadError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (loadError instanceof ApiRequestError && loadError.status === 404) {
          setStatus("ready");
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to check your student profile. Please try again.",
        );
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        {t("Loading your study space…")}
      </div>
    );
  }
  if (status === "error") {
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

  return (
    <OnboardingContent>
      <ProfileWizard />
    </OnboardingContent>
  );
}

function EditProfileRoute() {
  const { profile, setProfile } = useOutletContext<{
    profile: StudentProfile;
    setProfile: React.Dispatch<React.SetStateAction<StudentProfile | null>>;
  }>();
  const [initialValues, setInitialValues] = useState<ProfileFormValues | null>(
    null,
  );

  useEffect(() => {
    void import("@/components/profile/profile-wizard").then((module) => {
      setInitialValues(
        module.profileValuesFromApi({
          profile,
          subjects: profile.subjects,
          learningGoals: profile.learning_goals,
          availabilityDays: profile.availability_days,
          studyFormat: profile.study_format,
          groupSize: profile.group_size,
          language: profile.language,
          preferredHours: profile.preferred_hours,
          showInDiscovery: profile.show_in_discovery,
        }),
      );
    });
  }, [profile]);

  if (!initialValues) return <RouteLoading />;

  return (
    <ProfileSettingsFrame>
      <ProfileWizard
        initialValues={initialValues}
        mode="edit"
        onSaved={setProfile}
      />
    </ProfileSettingsFrame>
  );
}

function GroupRoute() {
  const { id } = useParams();
  return <GroupDetailsPage groupId={id ?? ""} />;
}

function ConversationRoute() {
  const { id } = useParams();
  return <ConversationPage conversationId={id ?? ""} />;
}

function StartConversationRoute() {
  const { studentId } = useParams();
  return <StartConversationPage studentId={studentId ?? ""} />;
}

function StudentRoute() {
  const { id } = useParams();
  return <StudentProfilePage studentId={id ?? ""} />;
}

function NotFoundRoute() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <p className="academic-kicker">404</p>
      <h1 className="mt-3 text-4xl">{t("Page not found")}</h1>
      <p className="mt-3 text-muted-foreground">
        {t("The page you requested does not exist.")}
      </p>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      <SmoothScroll />
      <RouteTitle />
      <RevealController />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/register" element={<RegisterRoute />} />
          <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
          <Route path="/reset-password" element={<ResetPasswordRoute />} />
          <Route path="/auth/verify" element={<VerifyEmailRoute />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/my-profile" element={<MyProfilePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupRoute />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route
              path="/messages/new/:studentId"
              element={<StartConversationRoute />}
            />
            <Route path="/messages/:id" element={<ConversationRoute />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/profile/:id" element={<StudentRoute />} />
            <Route path="/settings/profile" element={<EditProfileRoute />} />
          </Route>
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
