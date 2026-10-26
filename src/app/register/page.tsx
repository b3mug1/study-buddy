import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
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
