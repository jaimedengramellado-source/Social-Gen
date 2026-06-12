import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shared/app-header";

export default async function CalendarioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
