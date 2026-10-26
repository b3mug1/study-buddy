"use client";

import { ShieldCheck, ShieldMinus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { BlockedStudent } from "@/lib/api-types";

export function SafetyPage() {
  const [blocked, setBlocked] = useState<BlockedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      setBlocked(await authenticatedApiJson<BlockedStudent[]>("safety/blocks"));
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load safety settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function unblock(student: BlockedStudent) {
    setBusyId(student.student_id);
    try {
      await authenticatedApiRequest(`safety/blocks/${student.student_id}`, {
        method: "DELETE",
      });
      setBlocked((current) =>
        current.filter((item) => item.student_id !== student.student_id),
      );
      toast.success(`${student.full_name} has been unblocked.`);
    } catch (unblockError) {
      toast.error(
        unblockError instanceof Error
          ? unblockError.message
          : "Could not unblock this student.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Community safety
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage blocked students and report profiles or messages.
          </p>
        </div>
      </div>

      <section className="surface mt-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <UsersRound
            size={18}
            className="mt-0.5 text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold">Report or block someone</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Open a student profile to report or block the account. Use the
              flag next to a message to report that specific message. Blocking
              hides the profile from discovery and prevents new connection
              requests and direct messages.
            </p>
            <Link
              href="/discover"
              className="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Find a student
            </Link>
          </div>
        </div>
      </section>

      <section className="surface mt-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Blocked students</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              You can unblock an account at any time.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {blocked.length}
          </span>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </p>
        )}
        {loading ? (
          <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted/60" />
        ) : blocked.length ? (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {blocked.map((student) => (
              <li
                key={student.student_id}
                className="flex items-center gap-3 p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  {student.full_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "SB"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {student.full_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {student.major || "Student"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === student.student_id}
                  onClick={() => void unblock(student)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <ShieldMinus size={14} aria-hidden="true" /> Unblock
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No one is blocked.
          </div>
        )}
      </section>
    </main>
  );
}
