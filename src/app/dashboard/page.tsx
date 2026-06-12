import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";
import type { Profile } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: recentIdeas }, { data: recentScripts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("scripts").select("id, title, platform, viral_score, created_at, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);

  return (
    <DashboardClient
      profile={profile as Profile}
      recentIdeas={recentIdeas || []}
      recentScripts={recentScripts || []}
    />
  );
}
