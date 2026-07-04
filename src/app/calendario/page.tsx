import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarioClient } from "./calendario-client";

export default async function CalendarioPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: scripts } = await supabase
    .from("scripts")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "saved")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <CalendarioClient
      scripts={scripts ?? []}
      userEmail={user.email ?? ""}
    />
  );
}
