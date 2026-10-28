"use client";

import { useEffect } from "react";
import type { AnimationParams, JSAnimation } from "animejs";

const MOTION_SELECTOR = "[data-motion]";

export function RevealController() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    let disposed = false;
    let intersectionObserver: IntersectionObserver | undefined;
    let mutationObserver: MutationObserver | undefined;
    const runningAnimations = new Set<JSAnimation>();

    async function setup() {
      const { animate } = await import("animejs");
      if (disposed) return;

      document.documentElement.classList.add("anime-motion-enabled");

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const element = entry.target as HTMLElement;
            intersectionObserver?.unobserve(element);

            const motion = element.dataset.motion;
            const parsedDelay = Number(element.dataset.motionDelay ?? 0);
            const delay = Number.isFinite(parsedDelay)
              ? Math.min(Math.max(parsedDelay, 0), 600)
              : 0;
            const animationParams: AnimationParams = {
              opacity: [0, 1],
              duration: 680,
              delay,
              ease: "out(3)",
            };

            if (motion === "left")
              Object.assign(animationParams, { x: [18, 0] });
            else if (motion === "scale") {
              Object.assign(animationParams, { scale: [0.98, 1] });
            } else if (motion !== "fade") {
              Object.assign(animationParams, { y: [16, 0] });
            }

            const animation = animate(element, animationParams);
            element.dataset.motionState = "visible";
            runningAnimations.add(animation);
            void animation.then(() => runningAnimations.delete(animation));
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );

      const observeMarkedElements = (root: ParentNode) => {
        const elements = Array.from(
          root.querySelectorAll<HTMLElement>(MOTION_SELECTOR),
        );
        if (root instanceof Element && root.matches(MOTION_SELECTOR)) {
          elements.unshift(root as HTMLElement);
        }
        elements.forEach((element) => {
          if (element.dataset.motionState) return;
          element.dataset.motionState = "pending";
          intersectionObserver?.observe(element);
        });
      };

      observeMarkedElements(document);
      mutationObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) observeMarkedElements(node);
          }
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    void setup();

    return () => {
      disposed = true;
      mutationObserver?.disconnect();
      intersectionObserver?.disconnect();
      runningAnimations.forEach((animation) => animation.cancel());
      document.documentElement.classList.remove("anime-motion-enabled");
    };
  }, []);

  return null;
}
