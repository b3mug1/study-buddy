import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestApiFromServer } from "@/lib/api-server";

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await cookies();
  const response = await requestApiFromServer("profile");
  if (response.status === 401) redirect("/login");
  if (response.ok) redirect("/dashboard");
  if (response.status !== 404) {
    throw new Error("Unable to check your student profile. Please try again.");
  }

  return children;
}
