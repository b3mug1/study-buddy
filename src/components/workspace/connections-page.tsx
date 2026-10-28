"use client";

import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  MessageCircle,
  UserRound,
  UserRoundCheck,
  UserRoundPlus,
  X,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { Connection } from "@/lib/api-types";

export function ConnectionsPage() {
  const { t } = useI18n();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await authenticatedApiJson<Connection[]>("connections");
      setConnections(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your connections.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    try {
      await authenticatedApiRequest(`connections/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });
      toast.success(
        accept ? t("Connection accepted.") : t("Request declined."),
      );
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Could not update this connection.",
      );
    } finally {
      setBusyId("");
    }
  }

  const incoming = connections.filter(
    (connection) =>
      connection.direction === "incoming" && connection.status === "pending",
  );
  const accepted = connections.filter(
    (connection) => connection.status === "accepted",
  );
  const outgoing = connections.filter(
    (connection) =>
      connection.direction === "outgoing" && connection.status === "pending",
  );

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">
            {t("Your people")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("Connections")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              "Accept partner requests and keep track of the students you’ve connected with.",
            )}
          </p>
        </div>
        <Link
          href="/discover"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--primary-hover)]"
        >
          {t("Discover students")} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error}
        </p>
      )}

      {loading ? (
        <div
          className="surface mt-7 h-56 animate-pulse bg-muted/60"
          aria-label={t("Loading connections")}
        />
      ) : (
        <div className="mt-7 space-y-7">
          <ConnectionSection
            title={t("Requests for you")}
            subtitle="Review incoming study partner requests."
            icon={<UserRoundPlus size={18} aria-hidden="true" />}
            empty="No pending requests. New requests will appear here."
            connections={incoming}
            busyId={busyId}
            onRespond={respond}
          />
          <ConnectionSection
            title={t("Your study partners")}
            subtitle="Students you’ve connected with."
            icon={<UserRoundCheck size={18} aria-hidden="true" />}
            empty="Accepted connections will show up here."
            connections={accepted}
          />
          <ConnectionSection
            title={t("Sent requests")}
            subtitle="Requests waiting for a response."
            icon={<UserRound size={18} aria-hidden="true" />}
            empty="You don’t have any pending outgoing requests."
            connections={outgoing}
          />
        </div>
      )}
    </main>
  );
}

function ConnectionSection({
  title,
  subtitle,
  icon,
  empty,
  connections,
  busyId,
  onRespond,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  empty: string;
  connections: Connection[];
  busyId?: string;
  onRespond?: (id: string, accept: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <div>
          <h2 className="font-semibold">{t(title)}</h2>
          <p className="text-xs text-muted-foreground">{t(subtitle)}</p>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {connections.length}
        </span>
      </div>
      {connections.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {connections.map((connection) => (
            <li
              key={connection.id}
              className="surface flex items-center gap-3 p-4"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-accent-foreground ">
                {connection.full_name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {connection.full_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {connection.major} · {connection.university_name}
                </p>
              </div>
              {onRespond ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === connection.id}
                    onClick={() => onRespond(connection.id, false)}
                    aria-label={t("Decline {name}'s request", {
                      name: connection.full_name,
                    })}
                    className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === connection.id}
                    onClick={() => onRespond(connection.id, true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  >
                    {busyId === connection.id ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check size={15} aria-hidden="true" />
                    )}
                    {t("Accept")}
                  </button>
                </div>
              ) : connection.status === "accepted" ? (
                <Link
                  href="/messages"
                  aria-label={t("Open messages with {name}", {
                    name: connection.full_name,
                  })}
                  className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground hover:bg-accent dark:bg-accent "
                >
                  <MessageCircle size={17} aria-hidden="true" />
                </Link>
              ) : (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground dark:bg-accent ">
                  {t("Waiting")}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="surface px-4 py-5 text-sm text-muted-foreground">
          {t(empty)}
        </p>
      )}
    </section>
  );
}
