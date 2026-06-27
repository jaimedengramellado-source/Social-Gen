import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, fetchUserAIContext } from "@/lib/anthropic";
import { checkAndDeductCredits } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);
  const credit = await checkAndDeductCredits(user.id, "sorprendeme");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  // Get user's main channel for context
  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const platformHint = channel?.platform || "youtube_long";
  const nicheHint = channel?.niche || "general";

  const userPrompt = `Genera exactamente 5 ideas virales SORPRESA para:
- Plataforma: ${platformHint}
- Nicho: ${nicheHint}
${channel ? `- Descripción del canal: ${channel.niche_description || ""}` : ""}

IMPORTANTE: Estas ideas deben ser INESPERADAS, ORIGINALES y muy distintas entre sí. Sorprende al creador con ideas que no hubiera pensado.`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: userContext + SYSTEM_PROMPTS.ideas,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const ideas = JSON.parse(extractJSON(raw));

    const toInsert = ideas.slice(0, 5).map((idea: Record<string, unknown>) => ({
      user_id: user.id,
      channel_id: channel?.id || null,
      title: idea.title,
      description: idea.description,
      platform: platformHint,
      format: "surprise",
      niche: nicheHint,
      viral_score: idea.viral_score,
      hook_type: idea.hook_type,
      content_style: idea.content_style,
      is_saved: false,
    }));

    const { data: saved } = await supabase.from("ideas").insert(toInsert).select();

    return NextResponse.json({
      ideas: saved || ideas,
      creditsRemaining: credit.creditsRemaining,
    });
  } catch (err) {
    console.error("sorprendeme error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
