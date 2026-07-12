import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  // El evento de calendario asociado solo tiene sentido si aún no se publicó.
  if (post.calendar_event_id && post.status !== "published") {
    await supabase
      .from("calendar_events")
      .delete()
      .eq("id", post.calendar_event_id)
      .eq("user_id", user.id);
  }

  // Vídeo pendiente en el bucket (IG/TikTok sin publicar): liberarlo
  if (post.storage_path) {
    await supabase.storage.from("publish-videos").remove([post.storage_path]);
  }

  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
