import type { Metadata } from "next";
import { NotificationsPage } from "@/components/workspace/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
