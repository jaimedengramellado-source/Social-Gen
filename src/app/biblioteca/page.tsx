import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BibliotecaClient } from "./biblioteca-client";

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: orphanScripts }, { data: orphanIdeas }] = await Promise.all([
    supabase
      .from("projects")
      .select(`
        id, name, platform, niche, created_at,
        ideas(id, title, viral_score, platform, niche, is_saved, created_at, hook_type, description, content_style),
        scripts(id, title, platform, viral_score, status, created_at, share_token, niche)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("scripts")
      .select("id, title, platform, viral_score, status, created_at, share_token, niche")
      .eq("user_id", user.id)
      .is("project_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("ideas")
      .select("id, title, viral_score, platform, niche, is_saved, created_at, hook_type, description, content_style")
      .eq("user_id", user.id)
      .eq("is_saved", true)
      .is("project_id", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <BibliotecaClient
      projects={projects || []}
      orphanScripts={orphanScripts || []}
      orphanSavedIdeas={orphanIdeas || []}
    />
  );
}
