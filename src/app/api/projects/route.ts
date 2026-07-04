import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ projects: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "El nombre de la carpeta es obligatorio" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ project: data });
}
