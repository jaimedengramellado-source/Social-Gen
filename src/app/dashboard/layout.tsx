import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shared/app-header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <AppHeader />
      <main className="pb-16 md:pb-0">{children}</main>
    </div>
  );
}
