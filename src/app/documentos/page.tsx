import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DocumentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Go to most recent script, or create a new blank one
  const { data: recent } = await supabase
    .from("scripts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    redirect(`/documentos/${recent.id}`);
  }

  // No scripts yet — create a blank one
  const { data: newScript } = await supabase
    .from("scripts")
    .insert({ user_id: user.id, title: "Sin título", status: "draft", credits_used: 0 })
    .select("id")
    .single();

  if (newScript) redirect(`/documentos/${newScript.id}`);

  redirect("/crear");
}
