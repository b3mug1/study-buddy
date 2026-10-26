"use client";

import {
  ArrowLeft,
  ArrowUp,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  authenticatedApiJson,
  authenticatedApiRequest,
} from "@/lib/api-client";
import type { ChatMessage, Conversation } from "@/lib/api-types";
import { SafetyActions } from "@/components/workspace/safety-actions";

export function MessagesPage() {
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
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          Keep learning together
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Messages
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conversations are available after a student connection is accepted or
          you join a study group.
        </p>
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
        <div className="mt-7 space-y-3" aria-label="Loading conversations">
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
                className="surface flex items-center gap-4 p-4 transition hover:border-indigo-200 hover:shadow-md dark:hover:border-indigo-900"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                  <MessageCircle size={21} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">
                      {conversation.title}
                    </p>
                    {conversation.kind === "group" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        Group
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {conversation.last_message ?? "Start the conversation"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {conversation.last_message_at && (
                    <time className="text-xs text-muted-foreground">
                      {new Date(
                        conversation.last_message_at,
                      ).toLocaleDateString()}
                    </time>
                  )}
                  {conversation.unread_count > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-indigo-600 px-1.5 py-1 text-[11px] font-bold text-white">
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
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
            <MessageCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">No conversations yet</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Connect with a study partner or join a group to start a private,
            persistent conversation.
          </p>
          <Link
            href="/discover"
            className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Discover students
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
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ??
          (process.env.NODE_ENV === "production"
            ? ""
            : "http://localhost:8000");
        if (!apiUrl) {
          throw new Error(
            "Set NEXT_PUBLIC_API_URL to enable realtime messages.",
          );
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

  async function deleteMessage(messageId: string) {
    try {
      await authenticatedApiRequest(`messages/${messageId}`, {
        method: "DELETE",
      });
      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      );
      toast.success("Message deleted.");
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
          aria-label="Back to conversations"
          className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
          <MessageCircle size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">
            {conversation?.title ?? "Conversation"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {conversation?.kind === "group"
              ? "Group conversation"
              : "Private study chat"}{" "}
            ·{" "}
            {realtimeStatus === "live"
              ? "Live updates"
              : realtimeStatus === "connecting"
                ? "Connecting…"
                : "Refreshing periodically"}
          </p>
        </div>
        <MoreHorizontal
          size={19}
          className="text-muted-foreground"
          aria-hidden="true"
        />
      </header>

      <section
        aria-label="Conversation messages"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto border-x border-border bg-card/60 px-4 py-5"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <LoaderCircle
              className="animate-spin text-indigo-600"
              aria-label="Loading messages"
            />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
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
                className="rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:text-muted-foreground disabled:hover:bg-transparent dark:text-indigo-400 dark:hover:bg-indigo-950"
              >
                {loadingOlder
                  ? "Loading…"
                  : messages.length >= 50
                    ? "Load earlier messages"
                    : "You’re all caught up"}
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
                      className={`rounded-2xl px-4 py-3 ${mine ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-white text-foreground shadow-sm dark:bg-slate-800"}`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {message.body}
                      </p>
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <time dateTime={message.created_at}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                      {mine && <CheckCheck size={12} aria-label="Sent" />}
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
                          aria-label="Delete message"
                          className="ml-1 rounded p-1 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950"
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
          <span className="sr-only">Write a message</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            rows={1}
            placeholder="Write a message…"
            className="field-control max-h-32 min-h-11 resize-y"
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
          aria-label="Send message"
          disabled={!draft.trim() || sending}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-600 p-0 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </main>
  );
}
