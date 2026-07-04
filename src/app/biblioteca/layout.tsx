import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shared/app-header";

export default async function BibliotecaLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "var(--color-background)" }}>
      <AppHeader />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
