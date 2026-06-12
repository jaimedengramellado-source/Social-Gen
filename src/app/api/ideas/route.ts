import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { title, hook, viral_score, content_style } = await request.json();

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      user_id: user.id,
      title,
      description: hook,
      viral_score,
      content_style,
      is_saved: true,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ idea: data });
}
