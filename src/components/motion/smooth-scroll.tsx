"use client";

import { useEffect } from "react";

/**
 * Smoothly scrolls to in-page anchors with an eased, anime-driven scroll.
 * Falls back to native behaviour for reduced-motion users or when the target
 * element is missing.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let disposed = false;
    let activeAnimation: { cancel: () => void } | undefined;

    async function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const anchor = (event.target as Element | null)?.closest?.(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;

      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;

      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;

      event.preventDefault();
      activeAnimation?.cancel();

      const startY = window.scrollY;
      const headerOffset = 8;
      const destination =
        target.getBoundingClientRect().top + startY - headerOffset;
      const distance = destination - startY;
      if (Math.abs(distance) < 4) return;

      const { animate } = await import("animejs");
      if (disposed) return;

      const proxy = { y: startY };
      const animation = animate(proxy, {
        y: destination,
        duration: Math.min(Math.max(Math.abs(distance) * 0.5, 520), 1400),
        ease: "inOut(3)",
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          window.history.replaceState(null, "", hash);
        },
      });
      activeAnimation = animation;
    }

    document.addEventListener("click", handleClick);
    return () => {
      disposed = true;
      activeAnimation?.cancel();
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
