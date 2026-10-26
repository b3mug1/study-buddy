"use client";

import {
  Bell,
  BellRing,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { Notification } from "@/lib/api-types";

function notificationHref(notification: Notification) {
  if (notification.kind === "new_message" && notification.entity_id) {
    return `/messages/${notification.entity_id}`;
  }
  if (notification.entity_type === "study_group" && notification.entity_id) {
    return `/groups/${notification.entity_id}`;
  }
  if (
    notification.kind.startsWith("connection_") ||
    notification.kind === "connection_request"
  ) {
    return "/connections";
  }
  if (notification.entity_type === "study_session") {
    return "/sessions";
  }
  return "/dashboard";
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await authenticatedApiJson<Notification[]>(
        "notifications?limit=100",
      );
      setNotifications(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function markRead(id: string) {
    setSaving(id);
    try {
      await authenticatedApiRequest(`notifications/${id}/read`, {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification,
        ),
      );
    } catch (readError) {
      toast.error(
        readError instanceof Error
          ? readError.message
          : "Could not update the notification.",
      );
    } finally {
      setSaving("");
    }
  }

  async function markAllRead() {
    setSaving("all");
    try {
      await authenticatedApiRequest("notifications/read-all", {
        method: "POST",
      });
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? readAt,
        })),
      );
      toast.success("All notifications marked as read.");
    } catch (readError) {
      toast.error(
        readError instanceof Error
          ? readError.message
          : "Could not update notifications.",
      );
    } finally {
      setSaving("");
    }
  }

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            Stay in the loop
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            Connection requests, group updates, messages, and session invites.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={saving === "all"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {saving === "all" ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CheckCheck size={16} aria-hidden="true" />
            )}
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-7 space-y-3" aria-label="Loading notifications">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="surface h-20 animate-pulse bg-muted/60"
            />
          ))}
        </div>
      ) : notifications.length ? (
        <ul className="mt-7 space-y-2">
          {notifications.map((notification) => {
            const unread = !notification.read_at;
            const Icon =
              notification.kind === "new_message"
                ? MessageCircle
                : notification.kind.startsWith("group_")
                  ? UsersRound
                  : BellRing;
            return (
              <li
                key={notification.id}
                className={`surface flex items-start gap-3 p-4 ${unread ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/20" : ""}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${unread ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200" : "bg-muted text-muted-foreground"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      {notification.title}
                    </p>
                    {unread && (
                      <span
                        className="size-2 rounded-full bg-indigo-600"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {notification.body}
                  </p>
                  <time
                    dateTime={notification.created_at}
                    className="mt-2 block text-xs text-slate-400"
                  >
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={notificationHref(notification)}
                    onClick={() => unread && void markRead(notification.id)}
                    className="rounded-lg px-2.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                  >
                    View
                  </Link>
                  {unread && (
                    <button
                      type="button"
                      disabled={saving === notification.id}
                      onClick={() => void markRead(notification.id)}
                      aria-label="Mark notification as read"
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {saving === notification.id ? (
                        <LoaderCircle
                          size={15}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCheck size={15} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : !error ? (
        <section className="surface mt-7 flex min-h-56 flex-col items-center justify-center px-6 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <Bell size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">You’re all caught up</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New study activity will appear here.
          </p>
        </section>
      ) : null}
    </main>
  );
}
