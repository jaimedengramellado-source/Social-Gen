import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markdownToTiptap } from "@/lib/markdown-to-tiptap";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { content?: unknown; title?: unknown };
  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json({ error: "content requerido" }, { status: 400 });
  }

  const docTitle = (typeof body.title === "string" ? body.title : "").trim().slice(0, 100) || "Contenido generado";
  const tiptapContent = markdownToTiptap(body.content);

  const { data, error } = await supabase
    .from("scripts")
    .insert({
      user_id: user.id,
      title: docTitle,
      status: "draft",
      credits_used: 0,
      content: tiptapContent,
    })
    .select("id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, title: data.title });
}
