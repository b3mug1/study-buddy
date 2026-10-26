import type { Metadata } from "next";
import { MessagesPage } from "@/components/workspace/messages-page";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesRoute() {
  return <MessagesPage />;
}
