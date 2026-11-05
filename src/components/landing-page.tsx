import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Compass,
  FileText,
  MessageCircle,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "@/components/navigation/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotebookMark } from "@/components/notebook-mark";
import { StudyBuddyLogo } from "@/components/study-buddy-logo";
import { ApiRequestError, authenticatedApiJson } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

function StudyScene({ title }: { title: string }) {
  return (
    <svg
      className="study-scene"
      viewBox="0 0 600 510"
      role="img"
      aria-labelledby="study-scene-title"
    >
      <title id="study-scene-title">{title}</title>
      <g
        stroke="#292929"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M49 427c4-92 6-219 22-319 95-59 315-70 455 8 18 93 20 206 21 306-132 53-359 64-498 5z"
          fill="#A8DCC4"
        />
        <path
          d="M65 120c118-60 333-58 462 8M80 440c151 52 320 48 450-8"
          fill="none"
          strokeWidth="2"
          strokeDasharray="7 9"
        />
        <path
          d="M114 96l8-20 9 18 19 6-19 7-8 18-9-19-18-7zM502 70l5-12 5 12 12 4-12 5-5 13-5-13-11-5z"
          fill="#FFD76A"
        />
        <path
          d="M419 58c11-6 21-7 32-3M439 45l12 10-11 8M74 260c-13-6-19-18-16-29m-3 16 3-16 14 8"
          fill="none"
        />
        <path
          d="M178 139c-12-22-10-43 10-50 19-8 39 5 39 25 0 16-13 27-24 32"
          fill="#FFD76A"
        />
        <path
          d="M181 118c-1-18 3-27 15-34 6 10 21 11 29 16M185 119l-6 2m45-5 5 1"
          fill="#292929"
        />
        <path d="M191 115l-1 2m20-2 1 2m-17 12c5 5 11 5 16 0" fill="none" />
        <path
          d="M162 153c11-12 41-17 61-7 20 9 36 42 37 94l-83 22-28-72z"
          fill="#FF8066"
        />
        <path
          d="M170 179c10 26 23 42 43 52l51 13-9 24-67-13c-24-10-37-31-42-50"
          fill="#F7BE98"
        />
        <path
          d="M361 132c-3-23 12-39 35-40 22-1 34 17 33 39-1 16-11 28-27 31-21 2-36-9-41-30z"
          fill="#D9A07D"
        />
        <path
          d="M362 125c-5-26 9-43 35-43 20 0 37 13 37 36-12-11-24-18-35-17-7 12-21 20-37 24z"
          fill="#292929"
        />
        <path d="M382 131l1 2m26-2 1 2m-20 14c6 4 12 3 17-2" fill="none" />
        <path
          d="M362 163c14-12 43-13 60-3 26 16 34 49 32 83l-94 24-32-51c3-20 15-42 34-53z"
          fill="#A9D8F3"
        />
        <path
          d="M346 204c-5 23-17 43-39 53l-44 9 5 23 57-4c26-7 48-28 57-49"
          fill="#D9A07D"
        />
        <path
          d="M227 291c-20-11-43-9-61 1-21 12-28 39-23 72l94 4 33-46z"
          fill="#CBB7F5"
        />
        <path
          d="M177 275c-4-23 12-38 33-38 23 0 35 20 29 41-4 15-18 25-34 25-14 0-24-10-28-28z"
          fill="#C88B68"
        />
        <path
          d="M176 266c-2-18 10-34 29-35 21-2 36 10 36 32-14-12-30-17-45-11-6 5-12 10-20 14z"
          fill="#292929"
        />
        <path d="M196 273l1 2m25-1 1 2m-20 12c5 4 11 4 16 0" fill="none" />
        <path
          d="M136 357c33-34 241-44 329-9l-18 84c-81 22-223 23-292-2z"
          fill="#FFD76A"
        />
        <path d="M158 427c81 18 207 18 286 0" fill="none" />
        <path d="M251 351l92-5 25 35-88 6z" fill="#FFFFFF" />
        <path
          d="M270 356l24-2m-22 11 38-3m-32 12 30-2"
          fill="none"
          strokeWidth="2"
        />
        <path d="M379 351l30-5 7 23-29 5z" fill="#FF8066" />
        <path
          d="M392 348l6 19m-51-24c9-4 19-5 26-1"
          fill="none"
          strokeWidth="2"
        />
        <path
          d="M170 335c16-12 37-15 53-6l26 24-14 14-31-18-23 5"
          fill="#C88B68"
        />
        <path
          d="M459 260c17-8 36-6 49 1l-5 40c-18 7-34 6-51-2z"
          fill="#FFFFFF"
        />
        <path
          d="M460 272c15-4 30-3 43 2m-44 9c14-3 29-3 42 1"
          fill="none"
          strokeWidth="2"
        />
        <path d="M104 311l25-9 6 44-28 3z" fill="#A9D8F3" />
      </g>
    </svg>
  );
}

const features = [
  {
    title: "Find your study buddy",
    description: "Meet students taking your courses and learning at your pace.",
    icon: Compass,
    tone: "mint",
    href: "/discover",
  },
  {
    title: "Make a study group",
    description: "Turn a shared subject into a place to plan, talk, and learn.",
    icon: UsersRound,
    tone: "yellow",
    href: "/groups",
  },
  {
    title: "Plan your week",
    description:
      "Keep sessions and study goals together in one clear schedule.",
    icon: CalendarDays,
    tone: "blue",
    href: "/sessions",
  },
  {
    title: "Share what you know",
    description: "Bring notes and helpful materials to your next session.",
    icon: FileText,
    tone: "lavender",
    href: "/materials",
  },
] as const;

export function LandingPage() {
  const { t } = useI18n();
  const [sessionStatus, setSessionStatus] = useState<
    "checking" | "guest" | "authenticated" | "unavailable"
  >("checking");

  useEffect(() => {
    let active = true;
    void authenticatedApiJson<{ id: string }>("auth/me")
      .then(() => {
        if (active) setSessionStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSessionStatus(
          error instanceof ApiRequestError && error.status === 401
            ? "guest"
            : "unavailable",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const isAuthenticated = sessionStatus === "authenticated";
  return (
    <main className="landing-page doodle-landing min-h-screen bg-background text-foreground">
      <header className="landing-header doodle-header">
        <div className="doodle-container doodle-header__inner">
          <Link href="/" className="doodle-brand" aria-label="Study Buddy">
            <StudyBuddyLogo />
            <span>
              study buddy<span className="doodle-brand__dot">.</span>
            </span>
          </Link>
          <nav className="doodle-nav" aria-label={t("Main navigation")}>
            <a href="#features">{t("Features")}</a>
            <Link href="/discover">{t("Find study partners")}</Link>
            <Link href="/groups">{t("Study groups")}</Link>
            <a href="#community">{t("About")}</a>
          </nav>
          <div className="doodle-header__actions">
            <LanguageSwitcher compact />
            <ThemeToggle />
            {isAuthenticated ? (
              <Link href="/dashboard" className="landing-header-cta">
                {t("Dashboard")}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : sessionStatus === "guest" ? (
              <>
                <Link href="/login" className="doodle-login">
                  {t("Sign in")}
                </Link>
                <Link href="/register" className="landing-header-cta">
                  {t("Get started")}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <section className="doodle-hero doodle-container">
        <div className="doodle-hero__copy">
          <span className="doodle-eyebrow">
            <span aria-hidden="true">✳</span>
            {t("Your campus, your people")}
          </span>
          <h1>
            {t("Studying is better")}{" "}
            <span className="doodle-underline">{t("together.")}</span>
          </h1>
          <p>
            {t(
              "Find your people, organize study sessions, share knowledge, and make university life a little easier.",
            )}
          </p>
          <div className="doodle-hero__actions">
            <Link
              href={isAuthenticated ? "/discover" : "/register"}
              className="landing-primary-cta"
            >
              {t("Find your study buddy")}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <Link href="/groups" className="landing-secondary-cta">
              {t("Explore study groups")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="doodle-hero__note">
            <span aria-hidden="true">↗</span>
            {t("A little help goes a long way")}
          </div>
        </div>
        <div className="doodle-hero__art">
          <span className="doodle-art-label doodle-art-label--top">
            <MessageCircle size={17} aria-hidden="true" />
            {t("Let's study!")}
          </span>
          <StudyScene title={t("Students studying together")} />
          <span className="doodle-art-label doodle-art-label--bottom">
            <Check size={16} aria-hidden="true" />
            {t("Better together")}
          </span>
        </div>
      </section>

      <section id="features" className="doodle-features">
        <div className="doodle-container">
          <div className="doodle-section-head">
            <div>
              <span className="doodle-section-index">
                01 / {t("What you can do")}
              </span>
              <h2>
                {t("Everything you need to")}{" "}
                <span>{t("learn together.")}</span>
              </h2>
            </div>
            <p>
              {t(
                "A friendly home for the people, plans, and notes behind every good study session.",
              )}
            </p>
          </div>
          <div className="doodle-feature-grid">
            {features.map(
              ({ title, description, icon: Icon, tone, href }, index) => (
                <article
                  key={title}
                  className={`doodle-feature doodle-feature--${tone}`}
                >
                  <span className="doodle-feature__number">0{index + 1}</span>
                  <div className="doodle-feature__drawing" aria-hidden="true">
                    <span className="doodle-feature__scribble" />
                    <Icon size={52} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3>{t(title)}</h3>
                    <p>{t(description)}</p>
                    <Link
                      href={href}
                      className="doodle-feature__link"
                      aria-label={`${t(title)} — ${t("Open")}`}
                    >
                      <ArrowRight size={20} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="doodle-steps doodle-container">
        <div className="doodle-section-head">
          <div>
            <span className="doodle-section-index">
              02 / {t("How it works")}
            </span>
            <h2>
              {t("Three small steps.")}
              <br />
              <span>{t("A lot of good company.")}</span>
            </h2>
          </div>
          <p>{t("From a blank page to a study plan that actually happens.")}</p>
        </div>
        <ol className="doodle-step-list">
          <li>
            <span className="doodle-step-list__number">1</span>
            <BookOpen size={33} aria-hidden="true" />
            <h3>{t("Create your profile")}</h3>
            <p>{t("Add your courses and the way you like to study.")}</p>
          </li>
          <li>
            <span className="doodle-step-list__number">2</span>
            <UsersRound size={33} aria-hidden="true" />
            <h3>{t("Find your people")}</h3>
            <p>{t("Connect with classmates or join a study group.")}</p>
          </li>
          <li>
            <span className="doodle-step-list__number">3</span>
            <CalendarDays size={33} aria-hidden="true" />
            <h3>{t("Learn together")}</h3>
            <p>{t("Set a time, share notes, and keep going together.")}</p>
          </li>
        </ol>
      </section>

      <section id="community" className="doodle-community">
        <div className="doodle-container doodle-community__grid">
          <div className="doodle-community__copy">
            <span className="doodle-section-index">
              03 / {t("Inside Study Buddy")}
            </span>
            <h2>{t("A place for your whole study circle.")}</h2>
            <p>
              {t(
                "Find a partner, see what your group is working on, and keep your next session in view.",
              )}
            </p>
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="landing-primary-cta"
            >
              {t(isAuthenticated ? "Dashboard" : "Join the community")}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div
            className="doodle-workspace-preview"
            aria-label={t("Example workspace")}
          >
            <div className="doodle-workspace-preview__top">
              <span className="doodle-workspace-preview__brand">
                <NotebookMark />
                study buddy.
              </span>
              <span className="doodle-workspace-preview__sample">
                {t("Example workspace")}
              </span>
            </div>
            <div className="doodle-workspace-preview__body">
              <aside>
                <span className="is-active">
                  <BookOpen size={15} />
                  {t("Overview")}
                </span>
                <span>
                  <UsersRound size={15} />
                  {t("Study groups")}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {t("Schedule")}
                </span>
                <span>
                  <MessageCircle size={15} />
                  {t("Messages")}
                </span>
              </aside>
              <div className="doodle-workspace-preview__main">
                <span className="doodle-section-index">
                  {t("Your study week")}
                </span>
                <h3>{t("Let's make progress.")}</h3>
                <div className="doodle-preview-session">
                  <div>
                    <span>{t("Next session")}</span>
                    <strong>{t("Programming")}</strong>
                    <small>{t("Wednesday")} · 14:30</small>
                  </div>
                  <CalendarDays size={30} aria-hidden="true" />
                </div>
                <div className="doodle-preview-bottom">
                  <div>
                    <span>{t("Study group")}</span>
                    <strong>{t("Programming")}</strong>
                    <small>{t("Plan together")}</small>
                  </div>
                  <div>
                    <span>{t("Your notes")}</span>
                    <strong>{t("Keep ideas close")}</strong>
                    <small>{t("Ready for your session")}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="doodle-closer doodle-container">
        <div className="doodle-closer__paper">
          <span className="doodle-closer__star" aria-hidden="true">
            ✳
          </span>
          <span className="doodle-section-index">{t("A note for you")}</span>
          <h2>{t("Your next study buddy is waiting!")}</h2>
          <p>{t("Good ideas grow when we share them.")}</p>
          <Link
            href={isAuthenticated ? "/dashboard" : "/register"}
            className="landing-primary-cta"
          >
            {t(isAuthenticated ? "Dashboard" : "Let's get started")}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <footer className="doodle-footer">
        <div className="doodle-container">
          <span className="doodle-brand">
            <NotebookMark />
            <span>
              study buddy<span className="doodle-brand__dot">.</span>
            </span>
          </span>
          <p>{t("Made for students who learn better together.")}</p>
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {t("Back to top")} ↑
          </a>
        </div>
      </footer>
    </main>
  );
}
