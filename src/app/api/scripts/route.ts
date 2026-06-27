import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = body.title ?? "Sin título";

  const { data, error } = await supabase
    .from("scripts")
    .insert({
      user_id: user.id,
      title,
      status: "draft",
      credits_used: 0,
    })
    .select("id, title, platform, viral_score, status, created_at, share_token, niche")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script: data });
}
