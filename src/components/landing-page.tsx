import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Compass,
  Target,
  UsersRound,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";

const features = [
  {
    number: "01",
    title: "Find your study circle",
    description:
      "Meet students who share your subjects, interests, and preferred pace.",
    icon: Compass,
  },
  {
    number: "02",
    title: "Make a clear plan",
    description:
      "Schedule sessions, divide group tasks, and keep useful materials together.",
    icon: CalendarDays,
  },
  {
    number: "03",
    title: "See your progress",
    description:
      "Set weekly goals and make each study session count toward them.",
    icon: Target,
  },
];

export function LandingPage() {
  const { t } = useI18n();

  return (
    <main className="landing-page min-h-screen bg-background text-foreground">
      <header className="landing-header mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="brand-link" aria-label="Study Buddy">
          <span className="brand-link__icon" aria-hidden="true">
            <BookOpenCheck size={20} strokeWidth={2} />
          </span>
          <span className="brand-name">Study Buddy</span>
        </Link>
        <nav
          className="flex items-center gap-2 sm:gap-4"
          aria-label={t("Main navigation")}
        >
          <a
            className="landing-nav-link hidden lg:inline-flex"
            href="#how-it-works"
          >
            {t("How it works")}
          </a>
          <LanguageSwitcher compact />
          <ThemeToggle />
          <Link
            href="/login"
            className="landing-nav-link hidden sm:inline-flex"
          >
            {t("Sign in")}
          </Link>
          <Link href="/register" className="landing-header-cta">
            <span className="hidden sm:inline">{t("Join the community")}</span>
            <span className="sm:hidden">{t("Get started")}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className="landing-hero mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-24">
        <div>
          <p className="academic-kicker">{t("A student learning network")}</p>
          <h1 className="hero-title mt-5 max-w-xl text-balance">
            {t("Find your people. Study smarter.")}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            {t(
              "Find classmates who share your subjects and schedule. Plan sessions, exchange materials, and keep your goals moving.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/register" className="landing-primary-cta">
              {t("Get started")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/login" className="landing-secondary-cta">
              {t("Sign in")}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <p className="landing-hero__note mt-10 max-w-sm border-l-2 border-[var(--brand-accent)] pl-4 text-sm leading-6 text-muted-foreground">
            {t("A thoughtful space for university students")}
          </p>
        </div>

        <figure className="planner-preview">
          <figcaption className="planner-preview__caption">
            <span>{t("Example workspace")}</span>
            <span>STUDY BUDDY / 01</span>
          </figcaption>
          <div className="planner-preview__window" aria-hidden="true">
            <div className="planner-preview__rail">
              <span className="planner-preview__monogram">SB</span>
              <span className="is-active">
                <BookOpenCheck size={14} />
                {t("Overview")}
              </span>
              <span>
                <CalendarDays size={14} />
                {t("Study sessions")}
              </span>
              <span>
                <UsersRound size={14} />
                {t("Study groups")}
              </span>
            </div>
            <div className="planner-preview__content">
              <div className="planner-preview__heading">
                <span className="academic-kicker">{t("This week")}</span>
                <strong>{t("Your study week")}</strong>
              </div>
              <div className="planner-preview__section">
                <div className="planner-preview__section-title">
                  <span>{t("Upcoming sessions")}</span>
                  <CalendarDays size={17} />
                </div>
                <div className="planner-preview__session">
                  <time>
                    <span>{t("Monday")}</span>
                    <strong>09:00</strong>
                  </time>
                  <div>
                    <strong>{t("Mathematics")}</strong>
                    <span>{t("Study sessions")}</span>
                  </div>
                  <span className="planner-preview__status" />
                </div>
                <div className="planner-preview__session">
                  <time>
                    <span>{t("Wednesday")}</span>
                    <strong>14:30</strong>
                  </time>
                  <div>
                    <strong>{t("Programming")}</strong>
                    <span>{t("Study sessions")}</span>
                  </div>
                  <span className="planner-preview__status" />
                </div>
              </div>
              <div className="planner-preview__summary">
                <div>
                  <span>{t("Study groups")}</span>
                  <strong>{t("Make a clear plan")}</strong>
                </div>
                <div>
                  <span>{t("Weekly progress")}</span>
                  <strong>{t("See your progress")}</strong>
                </div>
              </div>
            </div>
          </div>
        </figure>
      </section>

      <section id="how-it-works" className="landing-features scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="landing-features__heading">
            <div>
              <p className="academic-kicker">{t("A practical study rhythm")}</p>
              <h2 className="mt-3 text-balance text-3xl sm:text-4xl">
                {t("Learn with purpose, together.")}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              {t(
                "Bring the structure of a study group to your everyday university life.",
              )}
            </p>
          </div>
          <ol className="feature-list mt-10">
            {features.map(({ number, title, description, icon: Icon }) => (
              <li key={number} className="feature-list__item">
                <span className="feature-list__number">{number}</span>
                <span className="feature-list__icon">
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3>{t(title)}</h3>
                <p>{t(description)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-closer mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="landing-closer__inner">
          <div>
            <p className="academic-kicker">
              {t("The semester, in good company")}
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl sm:text-4xl">
              {t("A better way to study together.")}
            </h2>
          </div>
          <Link href="/register" className="landing-primary-cta">
            {t("Find your study buddy")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <footer className="landing-footer mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="brand-name text-foreground">Study Buddy</span>
        <p>{t("Made for students who learn better together.")}</p>
      </footer>
    </main>
  );
}
