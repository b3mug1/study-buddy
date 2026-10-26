import type { Metadata } from "next";
import { ConversationPage } from "@/components/workspace/messages-page";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationPage conversationId={id} />;
}
