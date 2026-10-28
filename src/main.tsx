import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import "@/styles.css";

function getInitialLocale(): Locale {
  const match = document.cookie.match(
    /(?:^|;\s*)study_locale=(en|ru|kk)(?:;|$)/,
  );
  return (match?.[1] as Locale | undefined) ?? "en";
}

const locale = getInitialLocale();
document.documentElement.lang = locale;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("The application root element is missing.");

createRoot(rootElement).render(
  <React.StrictMode>
    <LocaleProvider initialLocale={locale}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LocaleProvider>
  </React.StrictMode>,
);
