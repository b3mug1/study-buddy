import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTheme(isDark ? "light" : "dark", {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
      aria-label={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
      className="theme-toggle grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="theme-toggle__icon">
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
    </button>
  );
}
