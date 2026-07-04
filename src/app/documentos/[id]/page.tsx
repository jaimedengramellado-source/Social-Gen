import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GDocsEditor } from "@/components/gdocs/GDocsEditor";
import type { ScriptListItem } from "@/components/gdocs/GDocsEditor";

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [scriptRes, allScriptsRes] = await Promise.all([
    supabase.from("scripts").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("scripts")
      .select("id, title, platform, viral_score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!scriptRes.data) redirect("/documentos");

  const script = scriptRes.data;

  return (
    <GDocsEditor
      scriptId={script.id}
      initialTitle={script.title || "Sin título"}
      initialContent={(script as Record<string, unknown>).content as object | null ?? null}
      legacyHook={script.hook as string | null}
      legacyIntro={script.intro as string | null}
      legacyMainContent={script.main_content as Array<{ section: string; content: string }> | null}
      legacyCta={script.cta as string | null}
      allScripts={(allScriptsRes.data ?? []) as ScriptListItem[]}
    />
  );
}
