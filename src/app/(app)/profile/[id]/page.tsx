import type { Metadata } from "next";
import { StudentProfilePage } from "@/components/workspace/student-profile-page";

export const metadata: Metadata = { title: "Student profile" };

export default async function StudentProfileRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentProfilePage studentId={id} />;
}
