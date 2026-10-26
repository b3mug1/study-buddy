"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

async function authenticationRequest(
  action: string,
  body: Record<string, string>,
) {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("The Study Buddy API is unavailable. Try again shortly.");
    }
    throw error;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? payload.detail
        : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "The authentication request could not be completed.",
    );
  }
  return payload;
}

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
const signInSchema = emailSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
const registerSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
});
const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type SignInValues = z.infer<typeof signInSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type EmailValues = z.infer<typeof emailSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

function StatusAlert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm transition-all ${
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/15"
          : "border-emerald-500/30 bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      }`}
    >
      {tone === "error" ? (
        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <div className="leading-snug">{children}</div>
    </div>
  );
}

function FormTabSwitcher({ active }: { active: "login" | "register" }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      <Link
        href="/login"
        className={`rounded-lg py-2 text-center text-xs font-semibold transition-all ${
          active === "login"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Sign In
      </Link>
      <Link
        href="/register"
        className={`rounded-lg py-2 text-center text-xs font-semibold transition-all ${
          active === "register"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Create Account
      </Link>
    </div>
  );
}

export function LoginForm({
  resetSuccess = false,
  authError,
}: {
  resetSuccess?: boolean;
  authError?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(
    authError
      ? { text: authError, tone: "error" }
      : resetSuccess
        ? {
            text: "Your password has been updated. Sign in with your new password.",
            tone: "success",
          }
        : null,
  );
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setMessage(null);
    try {
      await authenticationRequest("login", { email, password });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Unable to sign in.",
        tone: "error",
      });
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <div>
      <FormTabSwitcher active="login" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {message && (
          <StatusAlert tone={message.tone}>{message.text}</StatusAlert>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            University email
          </label>
          <div className="relative">
            <Mail
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className="field-control pl-10"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="field-control pl-10 pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {form.formState.isSubmitting ? (
            <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <>
              Sign In
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const submit = form.handleSubmit(async ({ fullName, email, password }) => {
    setMessage(null);
    try {
      await authenticationRequest("register", {
        full_name: fullName,
        email,
        password,
      });
      setMessage({
        text: "Account created! Setting up your session...",
        tone: "success",
      });
      // Directly log in and proceed to onboarding or dashboard
      setTimeout(() => {
        router.replace("/onboarding");
        router.refresh();
      }, 600);
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Unable to create your account.",
        tone: "error",
      });
    }
  });

  return (
    <div>
      <FormTabSwitcher active="register" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {message && (
          <StatusAlert tone={message.tone}>{message.text}</StatusAlert>
        )}

        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full name
          </label>
          <div className="relative">
            <User
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="fullName"
              autoComplete="name"
              placeholder="e.g. Bekzat Murat"
              className="field-control pl-10"
              aria-invalid={Boolean(form.formState.errors.fullName)}
              {...form.register("fullName")}
            />
          </div>
          {form.formState.errors.fullName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            University email
          </label>
          <div className="relative">
            <Mail
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className="field-control pl-10"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <Lock
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="field-control pl-10 pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {form.formState.isSubmitting ? (
            <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          ) : (
            <>
              Create Account
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });

  const submit = form.handleSubmit(async ({ email }) => {
    setMessage(null);
    try {
      await authenticationRequest("forgot-password", { email });
      setMessage({
        text: "If an account exists for that email, a password reset link has been sent.",
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Unable to process your request.",
        tone: "error",
      });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {message && (
        <StatusAlert tone={message.tone}>{message.text}</StatusAlert>
      )}
      <div className="space-y-1.5">
        <label htmlFor="fp-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          University email
        </label>
        <div className="relative">
          <Mail
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            className="field-control pl-10"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        ) : (
          "Send Reset Link"
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back to login
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  const submit = form.handleSubmit(async ({ password }) => {
    setMessage(null);
    try {
      await authenticationRequest("reset-password", { token, password });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset your password.",
      );
      return;
    }
    router.replace("/login?reset=success");
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {message && <StatusAlert tone="error">{message}</StatusAlert>}
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New password
        </label>
        <div className="relative">
          <Lock
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="field-control pl-10 pr-10"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirm password
        </label>
        <div className="relative">
          <Lock
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            className="field-control pl-10"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
        </div>
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
        ) : (
          "Save New Password"
        )}
      </button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);

  async function handleVerify() {
    setBusy(true);
    setMessage(null);
    try {
      if (token) {
        await authenticationRequest("verify-email", { token });
      }
      setMessage({
        text: "Email verified successfully! Redirecting to login...",
        tone: "success",
      });
      setTimeout(() => {
        router.replace("/login");
      }, 1000);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Unable to verify email.",
        tone: "error",
      });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && <StatusAlert tone={message.tone}>{message.text}</StatusAlert>}
      <p className="text-sm text-muted-foreground">
        Click below to complete email verification.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={handleVerify}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="animate-spin" size={18} /> : "Confirm Email"}
      </button>
      <div className="text-center">
        <Link href="/login" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Return to login
        </Link>
      </div>
    </div>
  );
}

