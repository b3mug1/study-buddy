import type { Metadata } from "next";
import { ConnectionsPage } from "@/components/workspace/connections-page";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsRoute() {
  return <ConnectionsPage />;
}
