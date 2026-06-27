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
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);
  const credit = await checkAndDeductCredits(user.id, "generate_script");
  if (!credit.ok) {
    return NextResponse.json(
      { error: credit.error, creditsRemaining: credit.creditsRemaining },
      { status: 402 }
    );
  }

  const body = await request.json();
  const { ideaId, projectId, idea, platform, niche, tone = "conversacional", duration } = body;

  const isShort = platform === "youtube_shorts" || platform === "tiktok" || platform === "reels";

  const userPrompt = `Escribe un guion viral completo para:
- Plataforma: ${platform}
- Tipo: ${isShort ? "VÍDEO CORTO" : "VÍDEO LARGO"}
- Duración objetivo: ${duration || (isShort ? "60 segundos" : "10 minutos")}
- Idea/Título: ${typeof idea === "object" ? idea.title : idea}
- Descripción: ${typeof idea === "object" ? idea.description : ""}
- Nicho: ${niche}
- Tono: ${tone}

Escribe el guion COMPLETO con el texto exacto a decir en cada sección.`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: userContext + SYSTEM_PROMPTS.script,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const scriptData = JSON.parse(extractJSON(raw));

    const title = typeof idea === "object" ? idea.title : String(idea);

    const { data: saved } = await supabase
      .from("scripts")
      .insert({
        user_id: user.id,
        idea_id: ideaId || null,
        project_id: projectId || null,
        title,
        platform,
        format: isShort ? "short" : "long",
        niche,
        duration: duration || (isShort ? "60s" : "10min"),
        tone,
        hook: scriptData.hook,
        intro: scriptData.intro,
        main_content: scriptData.main_content,
        retention_peaks: scriptData.retention_peaks,
        cta: scriptData.cta,
        title_suggestions: scriptData.title_suggestions,
        thumbnail_concepts: scriptData.thumbnail_concepts,
        viral_score: scriptData.viral_score,
        estimated_retention: scriptData.estimated_retention,
        status: "draft",
        credits_used: 3,
      })
      .select()
      .single();

    return NextResponse.json({
      script: { ...saved, hooks_variants: scriptData.hooks_variants },
      creditsRemaining: credit.creditsRemaining,
    });
  } catch (err) {
    console.error("generate-script error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
