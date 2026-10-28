"use client";

import { useI18n } from "@/lib/i18n";
import {
  ArrowRight,
  BookOpen,
  LockKeyhole,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useNavigate } from "react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { StudyGroup } from "@/lib/api-types";
import { GroupCollaborationPanel } from "@/components/workspace/group-collaboration-panel";

type CreatedGroup = { id: string };

export function GroupsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (subjectFilter.trim()) params.set("subject", subjectFilter.trim());
    try {
      const data = await authenticatedApiJson<StudyGroup[]>(
        `groups${params.size ? `?${params.toString()}` : ""}`,
      );
      setGroups(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load study groups.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, subjectFilter]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreating(true);
    const form = new FormData(formElement);
    try {
      const group = await authenticatedApiJson<CreatedGroup>("groups", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          subject: form.get("subject"),
          description: form.get("description"),
          visibility: form.get("visibility"),
          max_members: Number(form.get("max_members")),
        }),
      });
      toast.success(t("Your study group is ready."));
      formElement.reset();
      navigate(`/groups/${group.id}`);
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Could not create this study group.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function joinGroup(group: StudyGroup) {
    setJoiningId(group.id);
    try {
      const result = await authenticatedApiJson<{ status: string }>(
        `groups/${group.id}/join`,
        { method: "POST" },
      );
      toast.success(
        result.status === "joined"
          ? t("You joined the study group.")
          : t("Your request was sent to the group owner."),
      );
      await load();
    } catch (joinError) {
      toast.error(
        joinError instanceof Error
          ? joinError.message
          : "Could not join this study group.",
      );
    } finally {
      setJoiningId("");
    }
  }

  return (
    <main>
      <div>
        <p className="text-sm font-semibold text-primary">
          {t("Learn together")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Study groups")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("Find a focused group for a subject or start one with the study")}
        </p>
      </div>

      <section className="surface mt-7 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
            <Plus size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">{t("Create a study group")}</h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "Set a subject, choose public or private, and invite a few connections.",
              )}
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(event) => void createGroup(event)}
        >
          <label className="sm:col-span-1 lg:col-span-2">
            <span className="sr-only">{t("Group name")}</span>
            <input
              required
              minLength={3}
              maxLength={100}
              name="name"
              className="field-control"
              placeholder={t("Group name")}
            />
          </label>
          <label className="sm:col-span-1 lg:col-span-1">
            <span className="sr-only">{t("Group subject")}</span>
            <input
              required
              maxLength={80}
              name="subject"
              className="field-control"
              placeholder={t("Subject")}
            />
          </label>
          <label>
            <span className="sr-only">{t("Maximum group members")}</span>
            <select
              className="field-control"
              name="max_members"
              defaultValue="8"
            >
              {[4, 6, 8, 10, 12, 20, 50].map((size) => (
                <option key={size} value={size}>
                  Up to {size}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("Group visibility")}</span>
            <select
              className="field-control"
              name="visibility"
              defaultValue="public"
            >
              <option value="public">{t("Public")}</option>
              <option value="private">{t("Private")}</option>
            </select>
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="sr-only">{t("Group description")}</span>
            <input
              maxLength={1000}
              name="description"
              className="field-control"
              placeholder={t("A short description (optional)")}
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            <Plus size={16} aria-hidden="true" />
            {creating ? "Creating…" : t("Create group")}
          </button>
        </form>
      </section>

      <form
        className="mt-7 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">{t("Search study groups")}</span>
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            className="field-control pl-9"
            placeholder={t("Search group names")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">{t("Filter study groups by subject")}</span>
          <input
            className="field-control"
            placeholder={t("Filter by subject")}
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold transition hover:bg-muted"
        >
          <Search size={16} aria-hidden="true" /> {t("Search groups")}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="surface h-52 animate-pulse bg-muted/60"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : groups.length ? (
        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground dark:bg-accent ">
                  <BookOpen size={19} aria-hidden="true" />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {group.visibility === "private" ? (
                    <LockKeyhole size={12} aria-hidden="true" />
                  ) : null}
                  {group.visibility}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{group.name}</h2>
              <p className="mt-1 text-sm font-medium text-primary">
                {group.subject}
              </p>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {group.description ||
                  "A focused place to learn this subject together."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <UsersRound size={15} aria-hidden="true" />
                {group.member_count} / {group.max_members} {t("members")}
                <span className="ml-auto truncate">
                  {t("Hosted by")} {group.owner_name}
                </span>
              </div>
              <div className="mt-auto flex gap-2 border-t border-border pt-4">
                <Link
                  href={`/groups/${group.id}`}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  {t("View group")} <ArrowRight size={15} aria-hidden="true" />
                </Link>
                {group.is_member ? (
                  <span className="inline-flex h-10 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground dark:bg-accent ">
                    {t("Joined")}
                  </span>
                ) : group.join_status === "pending" ? (
                  <span className="inline-flex h-10 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground dark:bg-accent ">
                    {t("Requested")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={joiningId === group.id}
                    onClick={() => void joinGroup(group)}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-60"
                  >
                    {group.visibility === "private" ? "Request" : "Join"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : !error ? (
        <div className="surface mt-5 flex min-h-52 flex-col items-center justify-center px-6 text-center">
          <UsersRound size={24} className="text-primary" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">{t("No study groups found")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Create a group or try searching for another subject.")}
          </p>
        </div>
      ) : null}
    </main>
  );
}

export function GroupDetailsPage({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const [group, setGroup] = useState<StudyGroup>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await authenticatedApiJson<StudyGroup>(`groups/${groupId}`);
      setGroup(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this study group.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function perform(
    key: string,
    path: string,
    init: RequestInit,
    success: string,
  ) {
    setBusy(key);
    try {
      await authenticatedApiRequest(path, init);
      toast.success(success);
      await load();
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "That action failed.",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      "settings",
      `groups/${groupId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          subject: form.get("subject"),
          description: form.get("description"),
          visibility: form.get("visibility"),
          max_members: Number(form.get("max_members")),
        }),
      },
      "Group settings updated.",
    );
    setEditing(false);
  }

  if (loading) {
    return (
      <div
        className="surface h-72 animate-pulse bg-muted/60"
        aria-label={t("Loading group")}
      />
    );
  }
  if (error || !group) {
    return (
      <div>
        <Link
          href="/groups"
          className="text-sm font-medium text-primary hover:underline "
        >
          {t("← Back to groups")}
        </Link>
        <p
          role="alert"
          className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
        >
          {error || "Study group not found."}
        </p>
      </div>
    );
  }

  const currentOwnerView = group.owner_id === group.current_user_id;
  const pendingRequests = group.join_requests.filter(
    (request) => request.status === "pending",
  );

  return (
    <main>
      <Link
        href="/groups"
        className="text-sm font-medium text-primary hover:underline "
      >
        {t("← Back to study groups")}
      </Link>
      <section className="surface mt-5 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground dark:bg-accent ">
            <BookOpen size={23} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {group.name}
              </h1>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                {group.visibility}
              </span>
            </div>
            <p className="mt-1 font-medium text-primary">{group.subject}</p>
            <p className="mt-3 max-w-3xl leading-6 text-muted-foreground">
              {group.description || "A focused study group."}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("Hosted by")} {group.owner_name} · {group.member_count} /{" "}
              {group.max_members} {t("members")}
            </p>
          </div>
          {group.is_member ? (
            <div className="flex gap-2">
              {currentOwnerView && (
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {editing ? t("Close settings") : t("Edit settings")}
                </button>
              )}
              {!currentOwnerView && (
                <button
                  type="button"
                  disabled={busy === "leave"}
                  onClick={() =>
                    void perform(
                      "leave",
                      `groups/${groupId}/members/${group.current_user_id}`,
                      { method: "DELETE" },
                      "You left the study group.",
                    )
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {t("Leave")}
                </button>
              )}
            </div>
          ) : group.join_status === "pending" ? (
            <span className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground dark:bg-accent ">
              {t("Request pending")}
            </span>
          ) : (
            <button
              type="button"
              disabled={busy === "join"}
              onClick={() =>
                void perform(
                  "join",
                  `groups/${groupId}/join`,
                  { method: "POST" },
                  group.visibility === "private"
                    ? "Join request sent."
                    : "You joined the group.",
                )
              }
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {group.visibility === "private"
                ? "Request to join"
                : t("Join group")}
            </button>
          )}
        </div>

        {editing && currentOwnerView && (
          <form
            onSubmit={(event) => void saveSettings(event)}
            className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2"
          >
            <label className="text-sm font-medium">
              {t("Group name")}
              <input
                name="name"
                required
                minLength={3}
                maxLength={100}
                defaultValue={group.name}
                className="field-control mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              {t("Subject")}
              <input
                name="subject"
                required
                maxLength={80}
                defaultValue={group.subject}
                className="field-control mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              {t("Visibility")}
              <select
                name="visibility"
                defaultValue={group.visibility}
                className="field-control mt-1.5"
              >
                <option value="public">{t("Public")}</option>
                <option value="private">{t("Private")}</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              {t("Maximum members")}
              <select
                name="max_members"
                defaultValue={group.max_members}
                className="field-control mt-1.5"
              >
                {[2, 4, 6, 8, 10, 12, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              {t("Description")}
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={group.description}
                rows={3}
                className="field-control mt-1.5 resize-y"
              />
            </label>
            <button
              type="submit"
              disabled={busy === "settings"}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {t("Save group settings")}
            </button>
          </form>
        )}
      </section>

      {group.is_member && (
        <GroupCollaborationPanel
          groupId={groupId}
          groupName={group.name}
          members={group.members}
          ownerId={group.owner_id}
          currentUserId={group.current_user_id}
        />
      )}

      {group.is_member && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="surface p-5">
            <h2 className="font-semibold">{t("Group members")}</h2>
            <ul className="mt-4 space-y-2">
              {group.members.map((member) => (
                <li
                  key={member.student_id}
                  className="flex items-center gap-3 rounded-md bg-muted/50 p-3"
                >
                  <span className="grid size-9 place-items-center rounded-full text-xs font-semibold text-accent-foreground ">
                    {member.full_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.major || "Student"} · {member.role}
                    </p>
                  </div>
                  {currentOwnerView && member.role !== "owner" && (
                    <button
                      type="button"
                      disabled={busy === member.student_id}
                      onClick={() =>
                        void perform(
                          member.student_id,
                          `groups/${groupId}/members/${member.student_id}`,
                          { method: "DELETE" },
                          "Member removed.",
                        )
                      }
                      className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 "
                    >
                      {t("Remove")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {currentOwnerView && (
            <section className="surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{t("Join requests")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Approve students requesting this private group.")}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {pendingRequests.length}
                </span>
              </div>
              {pendingRequests.length ? (
                <ul className="mt-4 space-y-2">
                  {pendingRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {request.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {request.major || "Student"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy === request.id}
                        onClick={() =>
                          void perform(
                            request.id,
                            `groups/requests/${request.id}/respond`,
                            {
                              method: "POST",
                              body: JSON.stringify({ approve: false }),
                            },
                            t("Request declined."),
                          )
                        }
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                      >
                        {t("Decline")}
                      </button>
                      <button
                        type="button"
                        disabled={busy === request.id}
                        onClick={() =>
                          void perform(
                            request.id,
                            `groups/requests/${request.id}/respond`,
                            {
                              method: "POST",
                              body: JSON.stringify({ approve: true }),
                            },
                            "Student added to the group.",
                          )
                        }
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
                      >
                        {t("Approve")}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                  {t("No pending join requests.")}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
