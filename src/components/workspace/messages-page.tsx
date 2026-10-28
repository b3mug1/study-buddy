"use client";

import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  ArrowUp,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import Link from "@/components/navigation/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type {
  ChatMessage,
  Conversation,
  DiscoverableStudent,
} from "@/lib/api-types";
import { SafetyActions } from "@/components/workspace/safety-actions";

export function MessagesPage() {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await authenticatedApiJson<Conversation[]>("conversations");
      setConversations(data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your conversations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <main>
      <div>
        <p className="text-sm font-semibold text-primary">
          {t("Keep learning together")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("Messages")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Start a private chat from a student's profile. The first contact includes up to three messages while the student decides whether to accept.",
          )}
        </p>
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
        <div className="mt-7 space-y-3" aria-label={t("Loading conversations")}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="surface h-20 animate-pulse bg-muted/60"
            />
          ))}
        </div>
      ) : conversations.length ? (
        <ul className="mt-7 space-y-3">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="surface flex items-center gap-4 p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground dark:bg-accent ">
                  <MessageCircle size={21} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">
                      {conversation.title}
                    </p>
                    {conversation.kind === "group" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {t("Group")}
                      </span>
                    )}
                    {conversation.communication_status === "pending" && (
                      <span className="rounded-full bg-[var(--color-warning)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
                        {conversation.request_direction === "incoming"
                          ? t("Incoming chat request")
                          : t("Waiting for acceptance")}
                      </span>
                    )}
                    {conversation.communication_status === "declined" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t("Request declined")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {conversation.last_message ?? t("Start the conversation")}
                  </p>
                  {conversation.request_direction === "outgoing" &&
                    conversation.intro_messages_remaining !== null && (
                      <p className="mt-1 text-xs text-[var(--color-warning)]">
                        {t("{remaining} introductory messages left", {
                          remaining: conversation.intro_messages_remaining,
                        })}
                      </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {conversation.last_message_at && (
                    <time className="text-xs text-muted-foreground">
                      {new Date(
                        conversation.last_message_at,
                      ).toLocaleDateString(intlLocale)}
                    </time>
                  )}
                  {conversation.unread_count > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-1 text-[11px] font-bold text-primary-foreground">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : !error ? (
        <section className="surface mt-7 flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-accent text-accent-foreground dark:bg-accent ">
            <MessageCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">{t("No conversations yet")}</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {t(
              "Connect with a study partner or join a group to start a private, persistent conversation.",
            )}
          </p>
          <Link
            href="/discover"
            className="mt-4 text-sm font-semibold text-primary hover:underline "
          >
            {t("Discover students")}
          </Link>
        </section>
      ) : null}
    </main>
  );
}

export function ConversationPage({
  conversationId,
}: {
  conversationId: string;
}) {
  const { t, locale } = useI18n();
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation>();
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "live" | "polling"
  >("connecting");
  const [responding, setResponding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const [items, conversations] = await Promise.all([
        authenticatedApiJson<ChatMessage[]>(
          `conversations/${conversationId}/messages?limit=50`,
        ),
        authenticatedApiJson<Conversation[]>("conversations"),
      ]);
      setMessages(items);
      setConversation(conversations.find((item) => item.id === conversationId));
      await authenticatedApiRequest(`conversations/${conversationId}/read`, {
        method: "POST",
      });
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this conversation.",
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let fallbackInterval: number | undefined;
    const startFallbackPolling = () => {
      if (fallbackInterval === undefined) {
        fallbackInterval = window.setInterval(() => void loadMessages(), 4000);
      }
    };

    void Promise.resolve()
      .then(loadMessages)
      .then(async () => {
        const { ticket } = await authenticatedApiJson<{ ticket: string }>(
          `conversations/${conversationId}/ws-ticket`,
          { method: "POST" },
        );
        if (!active) return;
        const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
        if (!apiUrl) {
          throw new Error("Set VITE_API_URL to enable realtime messages.");
        }
        const websocketUrl = new URL(
          `/api/v1/ws/conversations/${conversationId}`,
          apiUrl,
        );
        websocketUrl.protocol =
          websocketUrl.protocol === "https:" ? "wss:" : "ws:";
        websocketUrl.searchParams.set("ticket", ticket);
        socket = new WebSocket(websocketUrl);
        socket.onopen = () => {
          setRealtimeStatus("live");
          if (fallbackInterval !== undefined) {
            window.clearInterval(fallbackInterval);
            fallbackInterval = undefined;
          }
        };
        socket.onmessage = (event) => {
          if (typeof event.data !== "string") return;
          try {
            const payload: unknown = JSON.parse(event.data);
            if (
              typeof payload === "object" &&
              payload !== null &&
              "event" in payload &&
              payload.event === "message"
            ) {
              void loadMessages();
            }
          } catch (parseError) {
            if (!(parseError instanceof SyntaxError)) throw parseError;
          }
        };
        socket.onclose = () => {
          if (active) {
            setRealtimeStatus("polling");
            startFallbackPolling();
          }
        };
        socket.onerror = () => socket?.close();
      })
      .catch(() => {
        if (!active) return;
        setRealtimeStatus("polling");
        startFallbackPolling();
      });

    return () => {
      active = false;
      if (fallbackInterval !== undefined) {
        window.clearInterval(fallbackInterval);
      }
      socket?.close();
    };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    let active = true;
    void authenticatedApiJson<{ id: string }>("auth/me")
      .then((user) => {
        if (active) setCurrentUserId(user.id);
      })
      .catch((error: unknown) => {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not verify the signed-in account.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true);
    try {
      const older = await authenticatedApiJson<ChatMessage[]>(
        `conversations/${conversationId}/messages?limit=50&before=${encodeURIComponent(first.created_at)}`,
      );
      setMessages((current) => [...older, ...current]);
    } catch (olderError) {
      toast.error(
        olderError instanceof Error
          ? olderError.message
          : "Could not load earlier messages.",
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await authenticatedApiJson<ChatMessage>(
        `conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      setMessages((current) =>
        current.some((message) => message.id === sent.id)
          ? current
          : [...current, sent],
      );
      setConversation((current) =>
        current
          ? {
              ...current,
              communication_status:
                sent.communication_status ?? current.communication_status,
              intro_messages_remaining: sent.intro_messages_remaining ?? null,
            }
          : current,
      );
      setDraft("");
    } catch (sendError) {
      toast.error(
        sendError instanceof Error
          ? sendError.message
          : "Could not send your message.",
      );
    } finally {
      setSending(false);
    }
  }

  async function respondToChatRequest(accept: boolean) {
    if (!conversation?.connection_id || responding) return;
    setResponding(true);
    try {
      await authenticatedApiRequest(
        `connections/${conversation.connection_id}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ accept }),
        },
      );
      toast.success(
        t(accept ? "Chat request accepted." : "Chat request declined."),
      );
      await loadMessages();
    } catch (responseError) {
      toast.error(
        responseError instanceof Error
          ? responseError.message
          : "Could not update this chat request.",
      );
    } finally {
      setResponding(false);
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      await authenticatedApiRequest(`messages/${messageId}`, {
        method: "DELETE",
      });
      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      );
      toast.success(t("Message deleted."));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the message.",
      );
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[34rem] max-w-4xl flex-col">
      <header className="surface flex shrink-0 items-center gap-3 rounded-b-none border-b-0 p-4">
        <Link
          href="/messages"
          aria-label={t("Back to conversations")}
          className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground dark:bg-accent ">
          <MessageCircle size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">
            {conversation?.title ?? "Conversation"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {conversation?.communication_status === "pending"
              ? conversation.request_direction === "incoming"
                ? t("Incoming chat request")
                : t("Waiting for acceptance")
              : conversation?.communication_status === "declined"
                ? t("Chat request declined.")
                : conversation?.kind === "group"
                  ? t("Group conversation")
                  : t("Private study chat")}{" "}
            ·{" "}
            {realtimeStatus === "live"
              ? t("Live updates")
              : realtimeStatus === "connecting"
                ? t("Connecting…")
                : t("Refreshing periodically")}
          </p>
        </div>
        <MoreHorizontal
          size={19}
          className="text-muted-foreground"
          aria-hidden="true"
        />
      </header>

      {conversation?.communication_status === "pending" && (
        <section
          className="border-x border-border bg-accent px-4 py-3 dark:bg-accent"
          role="status"
        >
          {conversation.request_direction === "incoming" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm dark:text-accent-foreground">
                {t(
                  "{name} sent a chat request. Accept it to reply and continue without limits.",
                  {
                    name: conversation.title,
                  },
                )}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  disabled={responding}
                  onClick={() => void respondToChatRequest(true)}
                  className="h-9 bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                >
                  {responding ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  {t("Accept chat")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={responding}
                  onClick={() => void respondToChatRequest(false)}
                  className="h-9"
                >
                  {t("Decline")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm dark:text-accent-foreground">
              {conversation.intro_messages_remaining === 0
                ? t(
                    "You have used your three introductory messages. Wait for the student to accept the chat request.",
                  )
                : t(
                    "You have {remaining} introductory messages left. The other student must accept before you can continue.",
                    {
                      remaining: conversation.intro_messages_remaining ?? 0,
                    },
                  )}
            </p>
          )}
        </section>
      )}

      {conversation?.communication_status === "declined" && (
        <p
          className="border-x border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {t("Chat request declined.")}
        </p>
      )}

      <section
        aria-label={t("Conversation messages")}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto border-x border-border bg-card/60 px-4 py-5"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <LoaderCircle
              className="animate-spin text-primary"
              aria-label={t("Loading messages")}
            />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 p-4 text-sm text-destructive "
          >
            {error}
          </p>
        ) : (
          <>
            <div className="mb-5 text-center">
              <button
                type="button"
                disabled={loadingOlder || messages.length < 50}
                onClick={() => void loadOlder()}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent dark:hover:bg-accent"
              >
                {loadingOlder
                  ? "Loading…"
                  : messages.length >= 50
                    ? "Load earlier messages"
                    : t("You’re all caught up")}
              </button>
            </div>
            {messages.map((message) => {
              const mine = message.author_id === currentUserId;
              return (
                <article
                  key={message.id}
                  className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`group max-w-[85%] sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}
                  >
                    {!mine && (
                      <p className="mb-1 ml-1 text-xs font-semibold text-muted-foreground">
                        {message.author_name}
                      </p>
                    )}
                    <div
                      className={`rounded-lg px-4 py-3 ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground shadow-sm"}`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {message.body}
                      </p>
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <time dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleTimeString(
                          intlLocale,
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                      {mine && <CheckCheck size={12} aria-label={t("Sent")} />}
                      {!mine && (
                        <SafetyActions
                          studentId={message.author_id}
                          studentName={message.author_name}
                          messageId={message.id}
                          compact
                        />
                      )}
                      {mine && (
                        <button
                          type="button"
                          onClick={() => void deleteMessage(message.id)}
                          aria-label={t("Delete message")}
                          className="ml-1 rounded p-1 opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100 "
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </section>

      <form
        onSubmit={(event) => void sendMessage(event)}
        className="surface flex shrink-0 items-end gap-3 rounded-t-none border-t-0 p-3 sm:p-4"
      >
        <label className="flex-1">
          <span className="sr-only">{t("Write a message")}</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            disabled={
              loading ||
              !conversation ||
              Boolean(error) ||
              conversation?.communication_status === "declined" ||
              (conversation?.communication_status === "pending" &&
                (conversation.request_direction === "incoming" ||
                  conversation.intro_messages_remaining === 0))
            }
            rows={1}
            placeholder={
              conversation?.communication_status === "pending" &&
              conversation.request_direction === "incoming"
                ? t("Accept the request to reply.")
                : conversation?.communication_status === "pending" &&
                    conversation.intro_messages_remaining === 0
                  ? t("Waiting for acceptance")
                  : conversation?.communication_status === "declined"
                    ? t("Chat request declined.")
                    : t("Write a message…")
            }
            className="field-control max-h-32 min-h-11 resize-y disabled:cursor-not-allowed disabled:opacity-60"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <Button
          type="submit"
          aria-label={t("Send message")}
          disabled={
            !draft.trim() ||
            sending ||
            loading ||
            !conversation ||
            conversation?.communication_status === "declined" ||
            (conversation?.communication_status === "pending" &&
              (conversation.request_direction === "incoming" ||
                conversation.intro_messages_remaining === 0))
          }
          className="grid size-11 shrink-0 place-items-center rounded-md bg-primary p-0 text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {sending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </main>
  );
}

export function StartConversationPage({ studentId }: { studentId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [student, setStudent] = useState<DiscoverableStudent>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void authenticatedApiJson<DiscoverableStudent>(`students/${studentId}`)
      .then((profile) => {
        if (active) setStudent(profile);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load this student's profile.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  async function sendFirstMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await authenticatedApiJson<ChatMessage>(
        "conversations/start",
        {
          method: "POST",
          body: JSON.stringify({ student_id: studentId, body }),
        },
      );
      navigate(`/messages/${message.conversation_id}`);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send the first message.",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div
        className="surface h-64 animate-pulse bg-muted/60"
        aria-label={t("Loading student profile")}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href={student ? `/profile/${student.id}` : "/discover"}
        className="inline-flex items-center gap-2 text-sm font-medium text-accent-foreground hover:underline "
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t("Back to discovery")}
      </Link>
      <section className="surface mt-5 p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground dark:bg-accent ">
            <MessageSquareText size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="academic-kicker">{t("A first hello")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {student
                ? t("Message {name}", { name: student.full_name })
                : t("Start a conversation")}
            </h1>
          </div>
        </div>
        {student?.connection_status === "accepted" ? (
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {t(
              "You are already connected. Your message will be delivered directly.",
            )}
          </p>
        ) : (
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {t(
              "Your first contact includes up to three messages. {name} can accept the chat at any time to unlock unlimited replies.",
              {
                name: student?.full_name ?? "This student",
              },
            )}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive "
          >
            {error}
          </p>
        )}
        {student ? (
          <form
            onSubmit={(event) => void sendFirstMessage(event)}
            className="mt-6 space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                {t("Your message")}
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                rows={5}
                required
                placeholder={t(
                  "Introduce yourself or mention a shared subject…",
                )}
                className="field-control min-h-32 resize-y"
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t("Only the recipient can unlock the full conversation.")}
              </p>
              <Button
                type="submit"
                disabled={!draft.trim() || sending}
                className="inline-flex h-11 items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {sending ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <ArrowUp size={16} />
                )}
                {t("Send first message")}
              </Button>
            </div>
          </form>
        ) : (
          <Link
            href="/discover"
            className="mt-6 inline-flex text-sm font-semibold text-accent-foreground hover:underline "
          >
            {t("Discover students")}
          </Link>
        )}
      </section>
    </main>
  );
}
