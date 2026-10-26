import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;
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
      <LoginForm resetSuccess={reset === "success"} authError={authError} />
    </AuthShell>
  );
}
