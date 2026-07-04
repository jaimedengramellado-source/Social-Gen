import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExplorarClient } from "./explorar-client";
import type { Profile } from "@/types";

export default async function ExplorarPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [profileRes, watchlistRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("watchlist_channels")
      .select("channel_url, channel_name, subscribers, engagement_tag")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ExplorarClient
      profile={profileRes.data as Profile}
      initialWatchlist={watchlistRes.data ?? []}
    />
  );
}
