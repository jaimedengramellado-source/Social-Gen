import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserAIContext, MODEL } from "@/lib/anthropic";
import { generateVideoProps } from "@/lib/video/generate-props";
import { checkAndDeductCredits, refundCredits, recordTokenUsage } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { CREDIT_COSTS } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: renders, error } = await supabase
    .from("video_renders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json({ renders: renders ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rl = await checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const body = await request.json();
  const instructions = String(body.instructions ?? "").trim().slice(0, 1000);
  const forcedTemplate = typeof body.template === "string" ? body.template : undefined;
  const forcedDuration = typeof body.durationSeconds === "number" ? body.durationSeconds : undefined;

  if (!instructions) {
    return NextResponse.json({ error: "MISSING_INSTRUCTIONS" }, { status: 400 });
  }

  const [userContext, profileRes] = await Promise.all([
    fetchUserAIContext(supabase, user.id),
    supabase.from("profiles").select("channel_name").eq("id", user.id).single(),
  ]);

  const channelName = profileRes.data?.channel_name?.trim() ?? "";
  const handle = channelName
    ? channelName.startsWith("@") ? channelName : `@${channelName.replace(/\s+/g, "").toLowerCase()}`
    : "";

  const credit = await checkAndDeductCredits(user.id, "generate_video");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  try {
    const config = await generateVideoProps({
      instructions,
      forcedTemplate,
      forcedDuration,
      userContext,
      handle,
    });

    await recordTokenUsage(credit.logId, MODEL, config.usage);

    const { data: render, error: insertError } = await supabase
      .from("video_renders")
      .insert({
        user_id: user.id,
        instructions,
        template: config.template,
        props: config.props,
        duration_seconds: config.durationSeconds,
        status: "queued",
        credits_spent: CREDIT_COSTS.generate_video,
      })
      .select()
      .single();

    if (insertError || !render) throw insertError ?? new Error("insert returned no row");

    return NextResponse.json({ render, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("video render create error:", err);
    await refundCredits(user.id, "generate_video");
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
