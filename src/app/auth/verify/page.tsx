import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell
      eyebrow="One last step"
      title="Verify your email."
      description="Confirm your university email address, then set up your Study Buddy profile."
    >
      <VerifyEmailForm token={token ?? ""} />
    </AuthShell>
  );
}
