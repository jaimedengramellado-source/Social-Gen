import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AjustesClient } from "./ajustes-client";
import type { Profile, Channel } from "@/types";

export default async function AjustesPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: channel },
    { data: usageLogs },
    { count: scriptsCount },
    { count: ideasCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("channels")
      .select("id, platform, niche, niche_description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("usage_logs")
      .select("action, credits_spent")
      .eq("user_id", user.id)
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("scripts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("ideas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const usageBreakdown = (usageLogs ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] ?? 0) + (row.credits_spent ?? 0);
    return acc;
  }, {});
  const usageByAction = Object.entries(usageBreakdown)
    .map(([action, total]) => ({ action, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <AjustesClient
      profile={profile as Profile}
      channel={channel as Pick<Channel, "id" | "platform" | "niche" | "niche_description"> | null}
      usageByAction={usageByAction}
      scriptsCount={scriptsCount ?? 0}
      ideasCount={ideasCount ?? 0}
    />
  );
}
