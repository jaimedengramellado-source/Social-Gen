import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: conn } = await supabase
    .from("youtube_connections")
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .single();

  // Revoking the refresh token invalidates the whole grant; best-effort so
  // local disconnect never fails because of Google
  const token = conn?.refresh_token ?? conn?.access_token;
  if (token) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => {});
  }

  await supabase.from("youtube_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
