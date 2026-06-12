import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS } from "@/lib/anthropic";
import { checkAndDeductCredits } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";
import { CREDIT_COSTS } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const body = await request.json();
  const { platform, niche, nicheDescription, count = 10, answers } = body;

  const actionKey = count <= 5
    ? "generate_5_ideas"
    : count <= 10
    ? "generate_10_ideas"
    : "generate_15_ideas";

  const credit = await checkAndDeductCredits(user.id, actionKey);
  if (!credit.ok) {
    return NextResponse.json(
      { error: credit.error, creditsRemaining: credit.creditsRemaining },
      { status: 402 }
    );
  }

  const platformLabels: Record<string, string> = {
    youtube_long: "YouTube (vídeo largo, 8-20 minutos)",
    youtube_shorts: "YouTube Shorts (menos de 60 segundos)",
    tiktok: "TikTok (15-90 segundos)",
    reels: "Instagram Reels (menos de 90 segundos)",
  };

  const userPrompt = `Genera exactamente ${count} ideas virales para:
- Plataforma: ${platformLabels[platform] || platform}
- Nicho: ${niche}
- Descripción del canal: ${nicheDescription || "Sin descripción adicional"}
${answers ? `- Contexto adicional: ${JSON.stringify(answers)}` : ""}

Genera ideas que REALMENTE funcionen para esta plataforma específica, con títulos listos para publicar.`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPTS.ideas,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const ideas = JSON.parse(extractJSON(raw));

    // Create project for this generation session
    const { data: project } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: niche, platform, niche })
      .select()
      .single();

    const projectId = project?.id ?? null;

    // Save ideas to DB
    const toInsert = ideas.map((idea: Record<string, unknown>) => ({
      user_id: user.id,
      project_id: projectId,
      title: idea.title,
      description: idea.description,
      platform,
      format: count <= 60 ? "short" : "long",
      niche,
      viral_score: idea.viral_score,
      hook_type: idea.hook_type,
      content_style: idea.content_style,
      is_saved: false,
    }));

    const { data: saved } = await supabase
      .from("ideas")
      .insert(toInsert)
      .select();

    const result = saved
      ? saved.map((dbIdea, i) => ({ ...dbIdea, why_viral: ideas[i]?.why_viral }))
      : ideas;

    return NextResponse.json({ ideas: result, projectId, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("generate-ideas error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
