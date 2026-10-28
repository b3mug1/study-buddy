"use client";

import { useEffect, useRef, useState } from "react";

type SplashState = "animating" | "leaving" | "done";

const BRAND_MARK = ["S", "B"];

/**
 * First-visit loading splash. Plays one anime.js timeline, then removes itself.
 * Shows only once per browser session and never blocks reduced-motion users.
 */
export function SplashScreen() {
  const [state, setState] = useState<SplashState>(() => {
    if (typeof window === "undefined") return "done";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return "done";
    return window.sessionStorage.getItem("study-splash-seen")
      ? "done"
      : "animating";
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state !== "animating") return;
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;

    const finish = () => {
      window.sessionStorage.setItem("study-splash-seen", "1");
      setState("leaving");
    };

    async function play() {
      const { createTimeline, stagger, utils } = await import("animejs");
      if (disposed) return;

      document.documentElement.style.overflow = "hidden";

      const letters = root!.querySelectorAll(".splash__letter");
      const ring = root!.querySelector(".splash__ring");
      const bar = root!.querySelector(".splash__bar span");
      const caption = root!.querySelector(".splash__caption");
      const mark = root!.querySelector(".splash__mark");

      const timeline = createTimeline({
        defaults: { ease: "out(3)" },
        onComplete: finish,
      });

      timeline
        .add(
          root!,
          { opacity: [0, 1], duration: 320 },
          // timeline plays from 0
        )
        .add(
          ring!,
          {
            scale: [0.4, 1],
            opacity: [0, 1],
            duration: 700,
            ease: "out(4)",
          },
          0,
        )
        .add(
          mark!,
          {
            scale: [0.5, 1],
            opacity: [0, 1],
            rotate: [-12, 0],
            duration: 700,
            ease: "out(5)",
          },
          120,
        )
        .add(
          letters,
          {
            opacity: [0, 1],
            y: [26, 0],
            scale: [0.7, 1],
            duration: 620,
            delay: stagger(90),
            ease: "out(5)",
          },
          260,
        )
        .add(caption!, { opacity: [0, 1], y: [10, 0], duration: 500 }, 620)
        .add(bar!, { scaleX: [0, 1], duration: 900, ease: "inOut(3)" }, 560)
        .add(
          root!,
          { opacity: [1, 0], scale: [1, 1.02], duration: 420, ease: "in(2)" },
          1500,
        );

      await timeline.then();
      if (disposed) return;

      // Safety net in case the timeline is interrupted
      utils.set(root!, { opacity: 0 });
      finish();
    }

    void play();

    return () => {
      disposed = true;
      document.documentElement.style.overflow = "";
    };
  }, [state]);

  useEffect(() => {
    if (state !== "leaving") return;
    const timeout = window.setTimeout(() => {
      document.documentElement.style.overflow = "";
      setState("done");
    }, 460);
    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    if (state === "done") document.documentElement.style.overflow = "";
  }, [state]);

  if (state === "done") return null;

  return (
    <div
      ref={rootRef}
      className={`splash ${state === "leaving" ? "splash--leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Study Buddy"
    >
      <div className="splash__inner">
        <div className="splash__ring" aria-hidden="true" />
        <div className="splash__mark" aria-hidden="true">
          <span className="splash__letter">{BRAND_MARK[0]}</span>
          <span className="splash__letter">{BRAND_MARK[1]}</span>
        </div>
        <p className="splash__caption">Study Buddy</p>
        <div className="splash__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
