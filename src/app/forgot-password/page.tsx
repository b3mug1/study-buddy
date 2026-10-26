import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Password reset is unavailable."
      description="This app does not send recovery emails. Contact the app administrator for help resetting your password."
    >
      <Link
        href="/login"
        className="block text-center text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
