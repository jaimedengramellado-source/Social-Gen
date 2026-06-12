import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AjustesClient } from "./ajustes-client";
import type { Profile } from "@/types";

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return <AjustesClient profile={profile as Profile} />;
}
