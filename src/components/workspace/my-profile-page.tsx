import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  GraduationCap,
  Languages,
  MapPin,
  Pencil,
  ShieldCheck,
  Target,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useOutletContext } from "react-router";
import type { StudentProfile } from "@/lib/api-types";
import { useI18n } from "@/lib/i18n";

const weekdayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatLabels = {
  online: "Online",
  offline: "In person",
  hybrid: "A mix of both",
} as const;

const timeLabels = {
  morning: "Morning · 8 am–12 pm",
  afternoon: "Afternoon · 12–5 pm",
  evening: "Evening · 5–10 pm",
} as const;

export function MyProfilePage() {
  const { profile } = useOutletContext<{ profile: StudentProfile }>();
  const { t } = useI18n();
  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const availableDays = profile.availability_days
    .slice()
    .sort((left, right) => left - right)
    .map((day) => weekdayLabels[day])
    .filter((day): day is string => Boolean(day))
    .map((day) => t(day));

  return (
    <main className="my-profile-page mx-auto max-w-5xl">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="academic-kicker">{profile.university_name}</p>
          <h1 className="mt-2 text-4xl">{t("My profile")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("View your academic information and study preferences.")}
          </p>
        </div>
        <Link href="/settings/profile" className="portal-button">
          <Pencil size={15} aria-hidden="true" />
          {t("Edit profile")}
        </Link>
      </header>

      <section className="profile-identity mt-6">
        <div className="profile-identity__mark" aria-hidden="true">
          {initials || "SB"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl">{profile.full_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.major} ·{" "}
            {t("Year {year}", { year: profile.year_of_study })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={13} aria-hidden="true" /> {profile.university_name}
          </p>
        </div>
        <span
          className={`profile-visibility ${profile.show_in_discovery ? "is-visible" : "is-hidden"}`}
        >
          <ShieldCheck size={15} aria-hidden="true" />
          {t(
            profile.show_in_discovery
              ? "Visible to students"
              : "Hidden from discovery",
          )}
        </span>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="surface p-5 sm:p-6">
          <div className="profile-section-heading">
            <BookOpen size={18} aria-hidden="true" />
            <h2 className="text-xl">{t("A little about you")}</h2>
          </div>
          {profile.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/85">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("No biography added yet.")}
            </p>
          )}
        </article>

        <article className="surface p-5 sm:p-6">
          <div className="profile-section-heading">
            <Target size={18} aria-hidden="true" />
            <h2 className="text-xl">{t("Subjects and goals")}</h2>
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Your subjects")}
            </h3>
            {profile.subjects.length ? (
              <ul className="profile-tags mt-2">
                {profile.subjects.map((subject) => (
                  <li key={subject}>{subject}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("No subjects added yet.")}
              </p>
            )}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Learning goals")}
            </h3>
            {profile.learning_goals.length ? (
              <ul className="profile-goals mt-2">
                {profile.learning_goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("No learning goals added yet.")}
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="surface mt-5 p-5 sm:p-6">
        <div className="profile-section-heading">
          <GraduationCap size={19} aria-hidden="true" />
          <h2 className="text-xl">{t("Study preferences")}</h2>
        </div>
        <dl className="profile-preferences mt-4">
          <div>
            <dt>
              <CalendarDays size={15} aria-hidden="true" />{" "}
              {t("Days you’re usually available")}
            </dt>
            <dd>
              {availableDays.length
                ? availableDays.join(", ")
                : t("No available days listed.")}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={15} aria-hidden="true" />{" "}
              {t("Preferred time of day")}
            </dt>
            <dd>{t(timeLabels[profile.preferred_hours])}</dd>
          </div>
          <div>
            <dt>
              <GraduationCap size={15} aria-hidden="true" /> {t("Study format")}
            </dt>
            <dd>{t(formatLabels[profile.study_format])}</dd>
          </div>
          <div>
            <dt>
              <Languages size={15} aria-hidden="true" />{" "}
              {t("Preferred study language")}
            </dt>
            <dd>{profile.language}</dd>
          </div>
          <div>
            <dt>
              <BookOpen size={15} aria-hidden="true" /> {t("Group size")}
            </dt>
            <dd>
              {profile.group_size} {t("students")}
            </dd>
          </div>
        </dl>
      </section>

      <Link href="/settings/profile" className="profile-edit-footer mt-5">
        {t("Edit your study profile")}{" "}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </main>
  );
}
