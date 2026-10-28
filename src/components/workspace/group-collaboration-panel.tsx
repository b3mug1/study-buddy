"use client";

import { useI18n } from "@/lib/i18n";
import {
  BookOpenText,
  Check,
  CircleDashed,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  Play,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type {
  GroupFocusSession,
  GroupMaterial,
  GroupMember,
  GroupTask,
} from "@/lib/api-types";

function formatRemaining(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GroupCollaborationPanel({
  groupId,
  groupName,
  members,
  ownerId,
  currentUserId,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  ownerId: string;
  currentUserId: string;
}) {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [materials, setMaterials] = useState<GroupMaterial[]>([]);
  const [focus, setFocus] = useState<GroupFocusSession | null>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const loadGroupContent = useCallback(async () => {
    try {
      const [taskItems, materialItems] = await Promise.all([
        authenticatedApiJson<GroupTask[]>(`groups/${groupId}/tasks`),
        authenticatedApiJson<GroupMaterial[]>(`groups/${groupId}/materials`),
      ]);
      setTasks(taskItems);
      setMaterials(materialItems);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the group workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadFocus = useCallback(async () => {
    try {
      setFocus(
        await authenticatedApiJson<GroupFocusSession | null>(
          `groups/${groupId}/focus`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the shared focus timer.",
      );
    }
  }, [groupId]);

  useEffect(() => {
    void Promise.resolve().then(loadGroupContent);
    void Promise.resolve().then(loadFocus);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => {
      void loadFocus();
    }, 10000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [loadFocus, loadGroupContent]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setWorking("task-create");
    try {
      await authenticatedApiJson<GroupTask>(`groups/${groupId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: values.get("title"),
          description: values.get("description"),
          assigned_to: values.get("assigned_to") || null,
          due_at: values.get("due_at")
            ? new Date(String(values.get("due_at"))).toISOString()
            : null,
        }),
      });
      form.reset();
      toast.success(t("Group task created."));
      await loadGroupContent();
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Could not create this task.",
      );
    } finally {
      setWorking("");
    }
  }

  async function updateTask(task: GroupTask, status: GroupTask["status"]) {
    setWorking(task.id);
    try {
      await authenticatedApiRequest(`groups/${groupId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadGroupContent();
    } catch (updateError) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Could not update this task.",
      );
    } finally {
      setWorking("");
    }
  }

  async function deleteTask(taskId: string) {
    setWorking(taskId);
    try {
      await authenticatedApiRequest(`groups/${groupId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      await loadGroupContent();
      toast.success(t("Task deleted."));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this task.",
      );
    } finally {
      setWorking("");
    }
  }

  async function addMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (!String(values.get("source_url") ?? "").trim()) {
      values.delete("source_url");
    }
    const selected = values.get("file");
    if (!(selected instanceof File) || selected.size === 0) {
      values.delete("file");
    }
    setWorking("material-create");
    try {
      await authenticatedApiRequest(`groups/${groupId}/materials`, {
        method: "POST",
        body: values,
      });
      form.reset();
      await loadGroupContent();
      toast.success(t("Shared material added."));
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Could not add this material.",
      );
    } finally {
      setWorking("");
    }
  }

  async function deleteMaterial(materialId: string) {
    setWorking(materialId);
    try {
      await authenticatedApiRequest(
        `groups/${groupId}/materials/${materialId}`,
        { method: "DELETE" },
      );
      await loadGroupContent();
      toast.success(t("Material removed."));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove this material.",
      );
    } finally {
      setWorking("");
    }
  }

  async function downloadMaterial(material: GroupMaterial) {
    setWorking(material.id);
    try {
      const response = await authenticatedApiRequest(
        `groups/${groupId}/materials/${material.id}/file`,
      );
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = material.file_name || material.title;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download this file.",
      );
    } finally {
      setWorking("");
    }
  }

  async function startFocus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setWorking("focus-start");
    try {
      const started = await authenticatedApiJson<GroupFocusSession>(
        `groups/${groupId}/focus`,
        {
          method: "POST",
          body: JSON.stringify({
            focus_minutes: Number(values.get("focus_minutes")),
            break_minutes: Number(values.get("break_minutes")),
          }),
        },
      );
      setFocus(started);
      toast.success(t("Shared focus session started."));
    } catch (startError) {
      toast.error(
        startError instanceof Error
          ? startError.message
          : "Could not start the focus session.",
      );
      await loadFocus();
    } finally {
      setWorking("");
    }
  }

  async function finishFocus() {
    if (!focus) return;
    setWorking("focus-finish");
    try {
      await authenticatedApiRequest(
        `groups/${groupId}/focus/${focus.id}/finish`,
        { method: "POST", body: "{}" },
      );
      setFocus(null);
      toast.success(t("Focus session completed."));
    } catch (finishError) {
      toast.error(
        finishError instanceof Error
          ? finishError.message
          : "Could not finish the focus session.",
      );
      await loadFocus();
    } finally {
      setWorking("");
    }
  }

  const focusSeconds = focus
    ? Math.max(0, Math.ceil((new Date(focus.ends_at).getTime() - now) / 1000))
    : 0;

  return (
    <section className="mt-6 space-y-5" aria-label={t("Group study tools")}>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error}
        </p>
      )}

      <section className="surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <UsersRound size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">{t("Group task board")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Assign work, set a deadline, and keep each other updated.")}
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void createTask(event)}
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-xs font-semibold sm:col-span-2 lg:col-span-2">
            {t("Task")}
            <input
              name="title"
              minLength={3}
              maxLength={120}
              required
              placeholder={t("Prepare notes")}
              className="field-control mt-1.5"
            />
          </label>
          <label className="text-xs font-semibold">
            {t("Assign to")}
            <select
              name="assigned_to"
              defaultValue=""
              className="field-control mt-1.5"
            >
              <option value="">{t("Unassigned")}</option>
              {members.map((member) => (
                <option key={member.student_id} value={member.student_id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            {t("Due date")}
            <input
              name="due_at"
              type="datetime-local"
              className="field-control mt-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={working === "task-create"}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {working === "task-create" ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {t("Add task")}
          </button>
          <label className="text-xs font-semibold sm:col-span-2 lg:col-span-5">
            {t("Details")}
            <textarea
              name="description"
              maxLength={1000}
              rows={2}
              className="field-control mt-1.5 resize-y"
            />
          </label>
        </form>

        {loading ? (
          <div className="mt-5 h-24 animate-pulse rounded-md bg-muted/60" />
        ) : tasks.length ? (
          <ul className="mt-5 divide-y divide-border rounded-md border border-border">
            {tasks.map((task) => {
              const canManage =
                task.created_by === currentUserId || ownerId === currentUserId;
              const canUpdate = canManage || task.assigned_to === currentUserId;
              return (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`font-semibold ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}
                      >
                        {task.title}
                      </h3>
                      {task.due_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                          <Clock3 size={12} aria-hidden="true" />
                          {new Date(task.due_at).toLocaleString(intlLocale, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {task.assignee_name
                        ? t("Assigned to {name}", { name: task.assignee_name })
                        : t("Unassigned")}{" "}
                      · {t("Added by")} {task.creator_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label
                      className="sr-only"
                      htmlFor={`task-status-${task.id}`}
                    >
                      {t("Task status")}
                    </label>
                    <select
                      id={`task-status-${task.id}`}
                      disabled={!canUpdate || working === task.id}
                      value={task.status}
                      onChange={(event) =>
                        void updateTask(
                          task,
                          event.target.value as GroupTask["status"],
                        )
                      }
                      className="field-control h-9 min-w-32 py-1.5 text-xs"
                    >
                      <option value="todo">{t("To do")}</option>
                      <option value="in_progress">{t("In progress")}</option>
                      <option value="done">{t("Done")}</option>
                    </select>
                    {canManage && (
                      <button
                        type="button"
                        disabled={working === task.id}
                        onClick={() => void deleteTask(task.id)}
                        aria-label={t("Delete {title}", { title: task.title })}
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover: disabled:opacity-50 "
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            {t("No tasks yet. Add the first item for")} {groupName}.
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
              <BookOpenText size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">{t("Shared materials")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Add class notes, links, and files up to 5 MB.")}
              </p>
            </div>
          </div>
          <form
            onSubmit={(event) => void addMaterial(event)}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            <label className="text-xs font-semibold sm:col-span-2">
              {t("Title")}
              <input
                name="title"
                minLength={2}
                maxLength={120}
                required
                className="field-control mt-1.5"
                placeholder={t("Week 4 lecture notes")}
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              {t("Note")}
              <textarea
                name="description"
                maxLength={1000}
                rows={2}
                className="field-control mt-1.5 resize-y"
                placeholder={t(
                  "What should the group know about this material?",
                )}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("Link")}
              <input
                name="source_url"
                type="url"
                maxLength={2048}
                className="field-control mt-1.5"
                placeholder="https://…"
              />
            </label>
            <label className="text-xs font-semibold">
              {t("Or attach a file")}
              <input
                name="file"
                type="file"
                accept=".pdf,.txt,.md,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
                className="mt-2 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-2.5 file:py-2 file:text-xs file:font-semibold"
              />
            </label>
            <button
              type="submit"
              disabled={working === "material-create"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50 sm:col-span-2"
            >
              {working === "material-create" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              {t("Add shared material")}
            </button>
          </form>
          <ul className="mt-5 space-y-2">
            {materials.map((material) => {
              const canDelete =
                material.created_by === currentUserId ||
                ownerId === currentUserId;
              return (
                <li
                  key={material.id}
                  className="flex items-start gap-3 rounded-md bg-muted/50 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary ">
                    {material.has_file ? (
                      <FileText size={17} aria-hidden="true" />
                    ) : (
                      <BookOpenText size={17} aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {material.title}
                    </p>
                    {material.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                        {material.description}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("Added by")} {material.creator_name}
                    </p>
                    {material.source_url && (
                      <a
                        href={material.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block break-all text-xs font-medium text-primary hover:underline "
                      >
                        {t("Open link")}
                      </a>
                    )}
                    {material.has_file && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {material.file_name}
                      </p>
                    )}
                  </div>
                  {material.has_file && (
                    <button
                      type="button"
                      disabled={working === material.id}
                      onClick={() => void downloadMaterial(material)}
                      aria-label={t("Download {title}", {
                        title: material.title,
                      })}
                      className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-card disabled:opacity-50"
                    >
                      <Download size={15} aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={working === material.id}
                      onClick={() => void deleteMaterial(material.id)}
                      aria-label={t("Delete {title}", {
                        title: material.title,
                      })}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover: disabled:opacity-50 "
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {!loading && materials.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("No shared materials yet.")}
            </p>
          )}
        </section>

        <section className="surface flex flex-col items-center p-5 text-center sm:p-6">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <CircleDashed size={19} aria-hidden="true" />
          </span>
          <h2 className="mt-3 font-semibold">{t("Shared Pomodoro")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("Everyone sees the same focus session and its end time.")}
          </p>
          {focus ? (
            <>
              <p
                className="mt-5 font-mono text-5xl font-semibold tabular-nums tracking-tight text-accent-foreground "
                aria-live="off"
              >
                {formatRemaining(focusSeconds)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {focusSeconds > 0
                  ? t("Started by {name} · {count} minute focus", {
                      name: focus.started_by_name ?? t("a group member"),
                      count: focus.focus_minutes,
                    })
                  : t("Finishing this session…")}
              </p>
              {focus.started_by === currentUserId && (
                <button
                  type="button"
                  onClick={() => void finishFocus()}
                  disabled={working === "focus-finish"}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <Check size={15} aria-hidden="true" />{" "}
                  {t("End focus session")}
                </button>
              )}
            </>
          ) : (
            <form
              onSubmit={(event) => void startFocus(event)}
              className="mt-5 grid w-full max-w-xs gap-3 text-left"
            >
              <label className="text-xs font-semibold">
                {t("Focus length")}
                <select
                  name="focus_minutes"
                  defaultValue="25"
                  className="field-control mt-1.5"
                >
                  {[15, 20, 25, 30, 45, 50, 60, 90, 120].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t("{count} minutes", { count: minutes })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                {t("Break")}
                <select
                  name="break_minutes"
                  defaultValue="5"
                  className="field-control mt-1.5"
                >
                  {[1, 3, 5, 10, 15, 20, 30].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t("{count} minutes", { count: minutes })}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={working === "focus-start"}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {working === "focus-start" ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Play size={15} />
                )}
                {t("Start together")}
              </button>
            </form>
          )}
          <p className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] text-muted-foreground">
            <Check size={12} aria-hidden="true" />{" "}
            {t("Group members can join at any time")}
          </p>
        </section>
      </div>
    </section>
  );
}
