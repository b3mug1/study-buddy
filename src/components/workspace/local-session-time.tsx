"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const clientSnapshot = () => true;

export function LocalSessionTime({ value }: { value: string }) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );

  return (
    <time dateTime={value}>
      {mounted
        ? new Date(value).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "Scheduled"}
    </time>
  );
}
