import type { Metadata } from "next";
import { GroupsPage } from "@/components/workspace/groups-page";

export const metadata: Metadata = { title: "Study groups" };

export default function GroupsRoute() {
  return <GroupsPage />;
}
