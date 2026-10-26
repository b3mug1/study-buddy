import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import {
  ProfileWizard,
  profileValuesFromApi,
} from "@/components/profile/profile-wizard";
import { getApiData, requestApiFromServer } from "@/lib/api-server";
import type { StudentProfile } from "@/lib/api-types";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const response = await requestApiFromServer("profile");
  if (response.status === 401) redirect("/login");
  if (response.status === 404) redirect("/onboarding");
  const profile = await getApiData<StudentProfile>(
    response,
    "Unable to load your student profile.",
  );
  const initialValues = profileValuesFromApi({
    profile,
    subjects: profile.subjects,
    learningGoals: profile.learning_goals,
    availabilityDays: profile.availability_days,
    studyFormat: profile.study_format,
    groupSize: profile.group_size,
    language: profile.language,
    preferredHours: profile.preferred_hours,
    showInDiscovery: profile.show_in_discovery,
  });

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to overview
      </Link>
      <div className="mt-6">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Your account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Edit your study profile
        </h1>
        <p className="mt-2 text-muted-foreground">
          Keep your profile and study preferences up to date.
        </p>
      </div>
      <div className="surface mt-7 p-5 sm:p-8">
        <ProfileWizard initialValues={initialValues} mode="edit" />
      </div>
      <div className="mt-5 flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Your information stays in your hands.</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            Profile and academic preference data are protected by database
            row-level security. Your discovery visibility setting is enforced by
            the API and database.
          </p>
        </div>
      </div>
    </main>
  );
}
