import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { releaseStorageIfUnused } from "@/lib/publish-storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const { data: post } = await supabase
    .from("scheduled_posts")
    .select("id, status, calendar_event_id, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Solo se borra el registro local: el vídeo ya publicado en la red no se toca.
  // Evento de calendario y vídeo del bucket pueden estar compartidos por el resto
  // de redes del mismo grupo: liberarlos solo si nadie más los necesita.
  if (post.calendar_event_id && post.status !== "published") {
    const { data: siblings } = await supabase
      .from("scheduled_posts")
      .select("id")
      .eq("calendar_event_id", post.calendar_event_id)
      .neq("id", post.id)
      .neq("status", "failed")
      .limit(1);
    if (!siblings?.length) {
      await supabase
        .from("calendar_events")
        .delete()
        .eq("id", post.calendar_event_id)
        .eq("user_id", user.id);
    }
  }

  // Las reglas condicionales que dependen de este post pierden su origen:
  // borrarlas antes de valorar si el vídeo del bucket queda huérfano
  await supabase
    .from("crosspost_rules")
    .delete()
    .eq("source_post_id", post.id)
    .eq("user_id", user.id)
    .eq("status", "waiting");

  await releaseStorageIfUnused(supabase, post.storage_path, { excludePostId: post.id });

  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
