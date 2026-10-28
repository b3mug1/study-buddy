"use client";

import { useI18n } from "@/lib/i18n";
import { Flag, ShieldBan } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authenticatedApiRequest } from "@/lib/api-client";

const reasons = [
  ["harassment", "Harassment"],
  ["spam", "Spam"],
  ["inappropriate", "Inappropriate content"],
  ["impersonation", "Impersonation"],
  ["other", "Other"],
] as const;

export function SafetyActions({
  studentId,
  studentName,
  messageId,
  compact = false,
}: {
  studentId: string;
  studentName: string;
  messageId?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function blockStudent() {
    setBusy(true);
    try {
      await authenticatedApiRequest("safety/blocks", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId }),
      });
      toast.success(t("{name} has been blocked.", { name: studentName }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not block this student.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await authenticatedApiRequest("safety/reports", {
        method: "POST",
        body: JSON.stringify({
          entity_type: messageId ? "message" : "profile",
          entity_id: messageId ?? studentId,
          reason: String(form.get("reason") ?? "other"),
          details: String(form.get("details") ?? ""),
        }),
      });
      toast.success(t("Report sent for review."));
      setReporting(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send this report.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col items-start" : "mt-3"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void blockStudent()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover: disabled:opacity-50 dark:hover:"
        >
          <ShieldBan size={13} aria-hidden="true" /> {t("Block")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setReporting((value) => !value)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 dark:hover:bg-accent dark:hover:"
        >
          <Flag size={13} aria-hidden="true" />
          {messageId ? "Report message" : "Report profile"}
        </button>
      </div>
      {reporting && (
        <form
          onSubmit={(event) => void report(event)}
          className="mt-2 grid w-full max-w-sm gap-2 rounded-md border border-border bg-card p-3 text-left shadow-sm"
        >
          <label className="text-xs font-medium">
            {t("Reason")}
            <select name="reason" className="field-control mt-1" required>
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            {t("Details (optional)")}
            <textarea
              name="details"
              maxLength={1000}
              rows={2}
              className="field-control mt-1 resize-y"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {t("Send report")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
