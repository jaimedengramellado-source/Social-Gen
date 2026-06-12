import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EstadisticasClient } from "./estadisticas-client";

export default async function EstadisticasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: connection } = await supabase
    .from("youtube_connections")
    .select("channel_id, channel_name, channel_thumbnail, subscriber_count, updated_at")
    .eq("user_id", user.id)
    .single();

  return <EstadisticasClient connection={connection ?? null} />;
}
