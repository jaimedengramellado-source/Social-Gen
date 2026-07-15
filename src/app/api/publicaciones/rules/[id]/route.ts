import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { releaseStorageIfUnused } from "@/lib/publish-storage";

// DELETE /api/publicaciones/rules/:id — borra la regla; con ?group=1 borra el
// grupo entero (una regla multi origen/destino se muestra como una sola en la UI)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const wholeGroup = new URL(request.url).searchParams.get("group") === "1";

  const { data: rule } = await supabase
    .from("crosspost_rules")
    .select("id, rule_group_id, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!rule) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const query = supabase.from("crosspost_rules").delete().eq("user_id", user.id);
  const { error } = wholeGroup
    ? await query.eq("rule_group_id", rule.rule_group_id)
    : await query.eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Liberar el vídeo del bucket si ya nada lo referencia
  await releaseStorageIfUnused(supabase, rule.storage_path);

  return NextResponse.json({ ok: true });
}
