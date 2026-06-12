import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CrearClient } from "./crear-client";
import type { Profile } from "@/types";

export default async function CrearPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return <CrearClient profile={profile as Profile} defaultChannel={channel} />;
}
