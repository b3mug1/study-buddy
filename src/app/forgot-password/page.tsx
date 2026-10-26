import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Let’s get you back in."
      description="Enter the email address on your account and we’ll send you a secure reset link."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
