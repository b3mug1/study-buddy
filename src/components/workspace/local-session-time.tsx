"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const clientSnapshot = () => true;

export function LocalSessionTime({ value }: { value: string }) {
  const { t, locale } = useI18n();
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );

  return (
    <time dateTime={value}>
      {mounted
        ? new Date(value).toLocaleString(
            locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US",
            {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
          )
        : t("Scheduled")}
    </time>
  );
}
