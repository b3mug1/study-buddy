import type { Metadata } from "next";
import { DiscoverPage } from "@/components/workspace/discover-page";

export const metadata: Metadata = { title: "Discover students" };

export default function DiscoverRoute() {
  return <DiscoverPage />;
}
