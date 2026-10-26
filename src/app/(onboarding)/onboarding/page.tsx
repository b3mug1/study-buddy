import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { ProfileWizard } from "@/components/profile/profile-wizard";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <BookOpenCheck size={19} aria-hidden="true" />
          </span>
          study buddy
        </Link>
      </header>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[0.72fr_1fr] lg:pt-14">
        <section className="max-w-md">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            Your student profile
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
            Let’s make this semester more connected.
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            A few details help us shape Study Buddy around how you learn. You
            can change anything later.
          </p>
          <div className="mt-8 space-y-4 text-sm text-muted-foreground">
            <p>
              ✦ Your subjects and goals help other students find shared
              interests.
            </p>
            <p>
              ✦ Your availability helps make future study matches more
              practical.
            </p>
            <p>✦ Your profile visibility stays under your control.</p>
          </div>
        </section>
        <section className="surface mx-auto w-full max-w-2xl p-5 sm:p-8">
          <ProfileWizard />
        </section>
      </div>
    </main>
  );
}
