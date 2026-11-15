"use client";

import type { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";
import Link from "@/components/navigation/link";
import { useI18n } from "@/lib/i18n";
import { authenticatedApiJson } from "@/lib/api-client";
import type { DiscoverableStudent, StudentProfile } from "@/lib/api-types";
import {
  ArrowLeft,
  Camera,
  Check,
  Clipboard,
  LoaderCircle,
  QrCode,
  Search,
  ShieldCheck,
  UserRoundSearch,
  X,
} from "lucide-react";

export function ConnectPage() {
  const { profile } = useOutletContext<{ profile: StudentProfile }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "scanning"
  >("idle");
  const [cameraError, setCameraError] = useState("");
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scanHandledRef = useRef(false);
  const scannerCancelledRef = useRef(false);
  const lookupStartedRef = useRef(false);

  const shareUrl = useMemo(() => {
    const url = new URL("/connect", window.location.origin);
    url.searchParams.set("code", profile.student_code);
    return url.toString();
  }, [profile.student_code]);

  const findStudent = useCallback(
    async (rawCode: string) => {
      const studentCode = rawCode.trim().toUpperCase();
      setCode(studentCode);
      setSearchError("");
      setSearching(true);
      try {
        const student = await authenticatedApiJson<DiscoverableStudent>(
          `students/by-code/${encodeURIComponent(studentCode)}`,
        );
        navigate(`/profile/${student.id}`);
      } catch (error) {
        setSearchError(
          error instanceof Error
            ? error.message
            : t("No visible student profile matches this ID."),
        );
      } finally {
        setSearching(false);
      }
    },
    [navigate, t],
  );

  useEffect(() => {
    const sharedCode = searchParams.get("code");
    if (!sharedCode || lookupStartedRef.current) return;
    lookupStartedRef.current = true;
    void findStudent(sharedCode);
  }, [findStudent, searchParams]);

  const stopScanner = useCallback(() => {
    scannerCancelledRef.current = true;
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setCameraState("idle");
  }, []);

  useEffect(
    () => () => {
      scannerCancelledRef.current = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    },
    [],
  );

  async function startScanner() {
    if (!videoRef.current) return;
    setCameraError("");
    setCameraState("starting");
    scanHandledRef.current = false;
    scannerCancelledRef.current = false;

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (scannerCancelledRef.current) return;
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, _error, scannerControls) => {
          if (!result || scanHandledRef.current || scannerCancelledRef.current)
            return;
          scanHandledRef.current = true;
          scannerCancelledRef.current = true;
          scannerControls.stop();
          controlsRef.current = null;
          readerRef.current = null;
          setCameraState("idle");
          void handleScannedValue(result.getText());
        },
      );
      if (readerRef.current === reader && !scannerCancelledRef.current) {
        controlsRef.current = controls;
        setCameraState("scanning");
      } else {
        controls.stop();
      }
    } catch (error) {
      if (scannerCancelledRef.current) return;
      readerRef.current = null;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraState("idle");
      const errorName =
        error instanceof DOMException ? error.name : "CameraError";
      setCameraError(
        errorName === "NotAllowedError" || errorName === "SecurityError"
          ? t("Allow camera access in your browser settings, then try again.")
          : errorName === "NotFoundError"
            ? t("No camera was found on this device.")
            : t("Unable to start the camera. Check that the page uses HTTPS."),
      );
    }
  }

  async function handleScannedValue(value: string) {
    const scannedValue = value.trim();
    const codeMatch = scannedValue.match(/SB-[A-F0-9]{12}/i);
    if (codeMatch) {
      await findStudent(codeMatch[0]);
      return;
    }

    try {
      const scannedUrl = new URL(scannedValue);
      const pathMatch = scannedUrl.pathname.match(
        /^\/profile\/([0-9a-f-]{36})$/i,
      );
      if (
        (scannedUrl.protocol === "https:" || scannedUrl.protocol === "http:") &&
        pathMatch
      ) {
        navigate(`/profile/${pathMatch[1]}`);
        return;
      }
    } catch {
      // Treat anything other than a Study Buddy code or profile link as invalid.
    }

    setCameraError(t("This QR code does not contain a Study Buddy profile."));
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(profile.student_code);
      setCopied(true);
      toast.success(t("Student ID copied."));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("Could not copy the ID. Select it and copy manually."));
    }
  }

  return (
    <main className="mx-auto max-w-5xl">
      <Link
        href="/my-profile"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t("My profile")}
      </Link>
      <header className="mt-4 border-b border-border pb-6">
        <p className="text-sm font-semibold text-primary">
          {t("Find each other")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Connect by QR or student ID")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t(
            "Share your personal code or scan a classmate’s QR to open their profile.",
          )}
        </p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="surface overflow-hidden p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <QrCode size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">
                {t("Your Study Buddy ID")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Let a classmate scan this QR or enter the code below.")}
              </p>
            </div>
          </div>

          <div className="mx-auto mt-6 grid w-fit place-items-center rounded-2xl border border-border bg-white p-4">
            <QRCodeSVG
              value={shareUrl}
              size={220}
              level="M"
              title={t("Scan to open my Study Buddy profile")}
            />
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("Personal ID")}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <code className="rounded-lg bg-muted px-4 py-2 text-lg font-bold tracking-[0.12em] text-foreground">
                {profile.student_code}
              </code>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition hover:bg-muted"
              >
                {copied ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Clipboard size={15} aria-hidden="true" />
                )}
                {t(copied ? "Copied" : "Copy ID")}
              </button>
            </div>
          </div>

          {!profile.show_in_discovery && (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <ShieldCheck
                size={17}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {t(
                  "Your profile is hidden. Turn on student discovery in profile settings before sharing your QR or ID.",
                )}{" "}
                <Link
                  href="/settings/profile"
                  className="font-semibold underline"
                >
                  {t("Profile settings")}
                </Link>
              </span>
            </p>
          )}
        </section>

        <section className="surface p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-sky)] text-[var(--brand-ink)]">
              <UserRoundSearch size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{t("Find a classmate")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "Scan their QR with your phone or type their Study Buddy ID.",
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/35 p-3">
            <div className="relative overflow-hidden rounded-lg bg-background">
              <video
                ref={videoRef}
                className={`aspect-[4/3] w-full object-cover ${cameraState === "idle" ? "hidden" : ""}`}
                muted
                playsInline
                aria-label={t("Camera QR scanner")}
              />
              {cameraState === "idle" ? (
                <div className="grid min-h-48 place-items-center border border-dashed border-border p-5 text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Camera size={22} aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-semibold">
                      {t("Use your camera")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("Camera access is only used to read a QR code.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => void startScanner()}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--primary-hover)]"
                    >
                      <Camera size={16} aria-hidden="true" /> {t("Open camera")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="size-44 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/65 px-3 py-2 text-sm text-white">
                    <span className="flex items-center gap-2">
                      {cameraState === "starting" ? (
                        <LoaderCircle
                          size={15}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="size-2 rounded-full bg-emerald-400" />
                      )}
                      {t(
                        cameraState === "starting"
                          ? "Starting camera…"
                          : "Point at a QR code",
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={stopScanner}
                      className="inline-flex size-8 items-center justify-center rounded-md hover:bg-white/15"
                      aria-label={t("Close camera")}
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          {cameraError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {cameraError}
            </p>
          )}

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("Or enter an ID")}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!searching) void findStudent(code);
            }}
          >
            <label htmlFor="student-code" className="text-sm font-semibold">
              {t("Student ID")}
            </label>
            <div className="flex gap-2">
              <input
                id="student-code"
                autoComplete="off"
                inputMode="text"
                maxLength={15}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="SB-12AB34CD56EF"
                className="field-control min-w-0 flex-1 font-mono uppercase tracking-wider"
                aria-describedby={
                  searchError ? "student-code-error" : undefined
                }
              />
              <button
                type="submit"
                disabled={searching || !code.trim()}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Search size={16} aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t("Find")}</span>
              </button>
            </div>
            {searchError && (
              <p
                id="student-code-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {searchError}
              </p>
            )}
          </form>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t(
              "Student codes only open profiles that their owners have made visible to discovery.",
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
