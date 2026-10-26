import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { getApiData, requestApiFromServer } from "@/lib/api-server";
import type { StudentProfile } from "@/lib/api-types";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await cookies();
  const response = await requestApiFromServer("profile");
  if (response.status === 401) redirect("/login");
  if (response.status === 404) redirect("/onboarding");
  const profile = await getApiData<StudentProfile>(
    response,
    "Unable to load your student profile.",
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <AppSidebar
        fullName={profile.full_name}
        university={profile.university_name}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 md:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
