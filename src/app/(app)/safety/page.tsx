import type { Metadata } from "next";
import { SafetyPage } from "@/components/workspace/safety-page";

export const metadata: Metadata = { title: "Community safety" };

export default function SafetyRoute() {
  return <SafetyPage />;
}
