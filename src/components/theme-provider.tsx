"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;
type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme");
  return saved === "light" || saved === "dark" || saved === "system"
    ? saved
    : "light";
}

type Ripple = { id: number; x: number; y: number; color: string };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setCurrentTheme] = useState<Theme>(readSavedTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const pendingRef = useRef<ResolvedTheme | null>(null);
  const busyRef = useRef(false);
  const counterRef = useRef(0);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () =>
      setSystemTheme(preference.matches ? "dark" : "light");
    updateSystemTheme();
    preference.addEventListener("change", updateSystemTheme);
    return () => preference.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Circular reveal that masks the switch, animated with anime.js
  const transitionTo = useCallback(
    async (
      next: ResolvedTheme,
      origin: { x?: number; y?: number } | undefined,
      commit: () => void,
    ) => {
      if (
        busyRef.current ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        commit();
        return;
      }

      const { animate } = await import("animejs");

      busyRef.current = true;
      pendingRef.current = next;
      counterRef.current += 1;
      setRipple({
        id: counterRef.current,
        x: origin?.x ?? window.innerWidth / 2,
        y: origin?.y ?? window.innerHeight / 2,
        color: next === "dark" ? "#0f0f0f" : "#ffffff",
      });

      // Let the overlay paint before it is animated
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const overlay = document.querySelector<HTMLElement>(
        "[data-theme-ripple]",
      );
      if (!overlay) {
        commit();
        busyRef.current = false;
        setRipple(null);
        return;
      }

      animate(overlay, {
        scale: [0, 1],
        duration: 620,
        ease: "inOut(4)",
        onComplete: () => {
          commit();
          pendingRef.current = null;
          animate(overlay, {
            opacity: [1, 0],
            duration: 380,
            ease: "out(2)",
            onComplete: () => {
              busyRef.current = false;
              setRipple(null);
            },
          });
        },
      });
    },
    [],
  );

  const setTheme = useCallback(
    (nextTheme: Theme, origin?: { x: number; y: number }) => {
      const nextResolved: ResolvedTheme =
        nextTheme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : nextTheme;

      const commit = () => {
        window.localStorage.setItem("theme", nextTheme);
        setCurrentTheme(nextTheme);
      };

      // No visual change needed (e.g. re-selecting the same theme)
      if (nextTheme === theme) {
        commit();
        return;
      }

      window.localStorage.setItem("theme", nextTheme);
      void transitionTo(nextResolved, origin, commit);
    },
    [theme, transitionTo],
  );

  const value = useMemo(
    () => ({ resolvedTheme, setTheme }),
    [resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {ripple && (
        <div
          key={ripple.id}
          data-theme-ripple
          aria-hidden="true"
          className="theme-ripple"
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            background: ripple.color,
          }}
        />
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}
