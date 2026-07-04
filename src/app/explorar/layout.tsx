import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shared/app-header";

export default async function ExplorarLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <AppHeader />
      <main className="pb-16 md:pb-0">{children}</main>
    </div>
  );
}
