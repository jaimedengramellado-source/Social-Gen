import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CrearClient } from "./crear-client";
import type { Profile } from "@/types";

export default async function CrearPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return <CrearClient profile={profile as Profile} />;
}
