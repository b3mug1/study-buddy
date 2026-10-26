import type { Metadata } from "next";
import { GroupDetailsPage } from "@/components/workspace/groups-page";

export const metadata: Metadata = { title: "Study group" };

export default async function StudyGroupRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupDetailsPage groupId={id} />;
}
