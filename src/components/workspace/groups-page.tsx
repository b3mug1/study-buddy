"use client";

import {
  ArrowRight,
  BookOpen,
  LockKeyhole,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { StudyGroup } from "@/lib/api-types";

type CreatedGroup = { id: string };

export function GroupsPage() {
  const router = useRouter();
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
      toast.success("Your study group is ready.");
      formElement.reset();
      router.push(`/groups/${group.id}`);
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
          ? "You joined the study group."
          : "Your request was sent to the group owner.",
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
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Learn together
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Study groups
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Find a focused group for a subject or start one with the study
        </p>
      </div>

      <section className="surface mt-7 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <Plus size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Create a study group</h2>
            <p className="text-xs text-muted-foreground">
              Set a subject, choose public or private, and invite a few
              connections.
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(event) => void createGroup(event)}
        >
          <label className="sm:col-span-1 lg:col-span-2">
            <span className="sr-only">Group name</span>
            <input
              required
              minLength={3}
              maxLength={100}
              name="name"
              className="field-control"
              placeholder="Group name"
            />
          </label>
          <label className="sm:col-span-1 lg:col-span-1">
            <span className="sr-only">Group subject</span>
            <input
              required
              maxLength={80}
              name="subject"
              className="field-control"
              placeholder="Subject"
            />
          </label>
          <label>
            <span className="sr-only">Maximum group members</span>
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
            <span className="sr-only">Group visibility</span>
            <select
              className="field-control"
              name="visibility"
              defaultValue="public"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="sr-only">Group description</span>
            <input
              maxLength={1000}
              name="description"
              className="field-control"
              placeholder="A short description (optional)"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus size={16} aria-hidden="true" />
            {creating ? "Creating…" : "Create group"}
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
          <span className="sr-only">Search study groups</span>
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            className="field-control pl-9"
            placeholder="Search group names"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">Filter study groups by subject</span>
          <input
            className="field-control"
            placeholder="Filter by subject"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
        >
          <Search size={16} aria-hidden="true" /> Search groups
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
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
                <span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200">
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
              <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {group.subject}
              </p>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {group.description ||
                  "A focused place to learn this subject together."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <UsersRound size={15} aria-hidden="true" />
                {group.member_count} / {group.max_members} members
                <span className="ml-auto truncate">
                  Hosted by {group.owner_name}
                </span>
              </div>
              <div className="mt-auto flex gap-2 border-t border-border pt-4">
                <Link
                  href={`/groups/${group.id}`}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  View group <ArrowRight size={15} aria-hidden="true" />
                </Link>
                {group.is_member ? (
                  <span className="inline-flex h-10 items-center rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                    Joined
                  </span>
                ) : group.join_status === "pending" ? (
                  <span className="inline-flex h-10 items-center rounded-xl bg-amber-50 px-3 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                    Requested
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={joiningId === group.id}
                    onClick={() => void joinGroup(group)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
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
          <UsersRound
            size={24}
            className="text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
          <h2 className="mt-3 font-semibold">No study groups found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a group or try searching for another subject.
          </p>
        </div>
      ) : null}
    </main>
  );
}

export function GroupDetailsPage({ groupId }: { groupId: string }) {
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
        aria-label="Loading group"
      />
    );
  }
  if (error || !group) {
    return (
      <div>
        <Link
          href="/groups"
          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to groups
        </Link>
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
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
        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Back to study groups
      </Link>
      <section className="surface mt-5 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
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
            <p className="mt-1 font-medium text-indigo-600 dark:text-indigo-400">
              {group.subject}
            </p>
            <p className="mt-3 max-w-3xl leading-6 text-muted-foreground">
              {group.description || "A focused study group."}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Hosted by {group.owner_name} · {group.member_count} /{" "}
              {group.max_members} members
            </p>
          </div>
          {group.is_member ? (
            <div className="flex gap-2">
              {currentOwnerView && (
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {editing ? "Close settings" : "Edit settings"}
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
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Leave
                </button>
              )}
            </div>
          ) : group.join_status === "pending" ? (
            <span className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
              Request pending
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
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {group.visibility === "private"
                ? "Request to join"
                : "Join group"}
            </button>
          )}
        </div>

        {editing && currentOwnerView && (
          <form
            onSubmit={(event) => void saveSettings(event)}
            className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2"
          >
            <label className="text-sm font-medium">
              Group name
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
              Subject
              <input
                name="subject"
                required
                maxLength={80}
                defaultValue={group.subject}
                className="field-control mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              Visibility
              <select
                name="visibility"
                defaultValue={group.visibility}
                className="field-control mt-1.5"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Maximum members
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
              Description
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
              className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save group settings
            </button>
          </form>
        )}
      </section>

      {group.is_member && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="surface p-5">
            <h2 className="font-semibold">Group members</h2>
            <ul className="mt-4 space-y-2">
              {group.members.map((member) => (
                <li
                  key={member.student_id}
                  className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-200">
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
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Remove
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
                  <h2 className="font-semibold">Join requests</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approve students requesting this private group.
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
                      className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3"
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
                            "Request declined.",
                          )
                        }
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                      >
                        Decline
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
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Approve
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  No pending join requests.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
