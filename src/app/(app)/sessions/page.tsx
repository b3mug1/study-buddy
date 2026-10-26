import type { Metadata } from "next";
import { SessionsPage } from "@/components/workspace/sessions-page";

export const metadata: Metadata = { title: "Study sessions" };

export default function SessionsRoute() {
  return <SessionsPage />;
}
