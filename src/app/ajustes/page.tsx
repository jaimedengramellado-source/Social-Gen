import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AjustesClient } from "./ajustes-client";
import type { Profile, Channel } from "@/types";

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: channel }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("channels")
      .select("id, platform, niche, niche_description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return (
    <AjustesClient
      profile={profile as Profile}
      channel={channel as Pick<Channel, "id" | "platform" | "niche" | "niche_description"> | null}
    />
  );
}
