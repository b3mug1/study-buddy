import type { Metadata } from "next";
import { ProgressPage } from "@/components/workspace/progress-page";

export const metadata: Metadata = { title: "Study progress" };

export default function ProgressRoute() {
  return <ProgressPage />;
}
