import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";
import type { Profile } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: recentIdeas },
    { data: recentScripts },
    { count: totalScripts },
    { count: totalIdeas },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("scripts").select("id, title, platform, viral_score, created_at, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("scripts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("ideas").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return (
    <DashboardClient
      profile={profile as Profile}
      recentIdeas={recentIdeas || []}
      recentScripts={recentScripts || []}
      totalScripts={totalScripts ?? 0}
      totalIdeas={totalIdeas ?? 0}
    />
  );
}
