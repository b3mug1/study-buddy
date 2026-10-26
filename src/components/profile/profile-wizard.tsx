"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveStudentProfile } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  parseListInput,
  profileSchema,
  weekdayOptions,
  type ProfileFormValues,
  type ValidProfile,
} from "@/lib/schemas/profile";

const steps = [
  { title: "About you", detail: "A few basics so people know who you are." },
  {
    title: "What you study",
    detail: "Add subjects and what you want to work toward.",
  },
  {
    title: "When you study",
    detail: "Choose a rhythm that works for your week.",
  },
  {
    title: "Your preferences",
    detail: "Set the details that make a study group feel right.",
  },
];

const inputClass = "field-control mt-1.5";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProfileWizard({
  initialValues,
  mode = "onboarding",
}: {
  initialValues?: Partial<ProfileFormValues>;
  mode?: "onboarding" | "edit";
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [actionError, setActionError] = useState("");
  const form = useForm<ProfileFormValues, unknown, ValidProfile>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initialValues?.fullName ?? "",
      universityName: initialValues?.universityName ?? "",
      major: initialValues?.major ?? "",
      yearOfStudy: initialValues?.yearOfStudy ?? 1,
      bio: initialValues?.bio ?? "",
      subjects: initialValues?.subjects ?? "",
      learningGoals: initialValues?.learningGoals ?? "",
      availabilityDays: initialValues?.availabilityDays ?? [],
      preferredHours: initialValues?.preferredHours ?? "afternoon",
      studyFormat: initialValues?.studyFormat ?? "hybrid",
      groupSize: initialValues?.groupSize ?? 4,
      language: initialValues?.language ?? "English",
      showInDiscovery: initialValues?.showInDiscovery ?? true,
    },
  });

  const stepFields = [
    ["fullName", "universityName", "major", "yearOfStudy", "bio"],
    ["subjects", "learningGoals"],
    ["availabilityDays", "preferredHours", "studyFormat"],
    ["groupSize", "language"],
  ] as const;

  async function nextStep() {
    const valid = await form.trigger(stepFields[step], { shouldFocus: true });
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  const submit = form.handleSubmit(async (values) => {
    setActionError("");
    try {
      await saveStudentProfile(values);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "We couldn't save your profile. Please try again.",
      );
      return;
    }
    if (mode === "onboarding") {
      toast.success("Your study profile is ready.");
      router.replace("/dashboard");
    } else {
      toast.success("Your profile was updated.");
      router.refresh();
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      <div
        className="flex items-center gap-2"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        {steps.map((item, index) => (
          <span
            key={item.title}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= step ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Step {step + 1} of {steps.length}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          {steps[step].title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {steps[step].detail}
        </p>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Field
            label="Full name"
            error={form.formState.errors.fullName?.message}
          >
            <input
              autoComplete="name"
              className={inputClass}
              placeholder="Your name"
              {...form.register("fullName")}
            />
          </Field>
          <Field
            label="University"
            error={form.formState.errors.universityName?.message}
          >
            <input
              autoComplete="organization"
              className={inputClass}
              placeholder="University name"
              {...form.register("universityName")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Faculty or major"
              error={form.formState.errors.major?.message}
            >
              <input
                className={inputClass}
                placeholder="e.g. Biology"
                {...form.register("major")}
              />
            </Field>
            <Field
              label="Year of study"
              error={form.formState.errors.yearOfStudy?.message}
            >
              <select className={inputClass} {...form.register("yearOfStudy")}>
                {Array.from({ length: 8 }, (_, index) => index + 1).map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                      {year === 1
                        ? "st"
                        : year === 2
                          ? "nd"
                          : year === 3
                            ? "rd"
                            : "th"}{" "}
                      year
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <Field
            label="A little about you"
            hint="Share what you enjoy learning or what makes a good study session for you."
            error={form.formState.errors.bio?.message}
          >
            <textarea
              rows={3}
              maxLength={300}
              className={`${inputClass} resize-y`}
              placeholder="A few words about how you like to learn…"
              {...form.register("bio")}
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field
            label="Subjects"
            hint="Add up to 12 topics, separated by commas."
            error={form.formState.errors.subjects?.message}
          >
            <input
              className={inputClass}
              placeholder="e.g. Biology, Statistics, Psychology"
              {...form.register("subjects")}
            />
          </Field>
          <Field
            label="Learning goals"
            hint="What would you like to get out of studying together?"
            error={form.formState.errors.learningGoals?.message}
          >
            <input
              className={inputClass}
              placeholder="e.g. Prepare for exams, stay motivated"
              {...form.register("learningGoals")}
            />
          </Field>
          <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
            <Sparkles
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            These interests help us make future study partner recommendations
            more relevant.
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field
            label="Days you’re usually available"
            error={form.formState.errors.availabilityDays?.message}
          >
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map(({ label, value }) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="checkbox"
                    value={value}
                    className="peer sr-only"
                    {...form.register("availabilityDays")}
                  />
                  <span className="grid min-h-11 place-items-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground transition peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 dark:peer-checked:bg-indigo-950 dark:peer-checked:text-indigo-200">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Preferred time of day">
            <select className={inputClass} {...form.register("preferredHours")}>
              <option value="morning">Morning · 8 am–12 pm</option>
              <option value="afternoon">Afternoon · 12–5 pm</option>
              <option value="evening">Evening · 5–10 pm</option>
            </select>
          </Field>
          <Field label="Study format">
            <select className={inputClass} {...form.register("studyFormat")}>
              <option value="online">Online</option>
              <option value="offline">In person</option>
              <option value="hybrid">A mix of both</option>
            </select>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Field
            label="Ideal study group size"
            hint="You can always join a larger community later."
            error={form.formState.errors.groupSize?.message}
          >
            <select className={inputClass} {...form.register("groupSize")}>
              {[2, 3, 4, 5, 6, 8, 10, 12].map((size) => (
                <option key={size} value={size}>
                  {size} students
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Preferred study language"
            error={form.formState.errors.language?.message}
          >
            <input
              className={inputClass}
              placeholder="e.g. English"
              {...form.register("language")}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-indigo-600"
              {...form.register("showInDiscovery")}
            />
            <span>
              <span className="block text-sm font-medium">
                Show my profile in student discovery
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                When turned off, other students cannot find your profile,
                subjects, availability, or study preferences.
              </span>
            </span>
          </label>
          <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
            You can update these details and your discovery visibility anytime.
          </div>
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
        >
          {actionError}
        </p>
      )}

      <div className="flex gap-3 border-t border-border pt-5">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-4"
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft className="mr-2" aria-hidden="true" /> Back
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button
            type="button"
            className="h-11 flex-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={nextStep}
          >
            Continue <ArrowRight className="ml-auto" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-11 flex-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {form.formState.isSubmitting ? (
              <>
                <LoaderCircle
                  className="mr-2 animate-spin"
                  aria-hidden="true"
                />{" "}
                Saving profile…
              </>
            ) : (
              <>
                <Check className="mr-2" aria-hidden="true" />{" "}
                {mode === "onboarding" ? "Finish setup" : "Save changes"}
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

export function profileValuesFromApi({
  profile,
  subjects,
  learningGoals,
  availabilityDays,
  studyFormat,
  groupSize,
  language,
  showInDiscovery,
  preferredHours,
}: {
  profile: {
    full_name: string;
    university_name: string;
    major: string;
    year_of_study: number;
    bio: string;
  };
  subjects: string[];
  learningGoals: string[];
  availabilityDays: number[];
  studyFormat: string;
  groupSize: number;
  language: string;
  showInDiscovery: boolean;
  preferredHours: string;
}): ProfileFormValues {
  return {
    fullName: profile.full_name,
    universityName: profile.university_name,
    major: profile.major,
    yearOfStudy: profile.year_of_study,
    bio: profile.bio,
    subjects: parseListInput(subjects),
    learningGoals: parseListInput(learningGoals),
    availabilityDays: availabilityDays
      .map(String)
      .filter((day): day is ProfileFormValues["availabilityDays"][number] =>
        weekdayOptions.some((option) => option.value === day),
      ),
    preferredHours: preferredHours as ProfileFormValues["preferredHours"],
    studyFormat: studyFormat as ProfileFormValues["studyFormat"],
    groupSize,
    language,
    showInDiscovery,
  };
}
