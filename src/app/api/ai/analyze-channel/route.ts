import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, fetchUserAIContext, THINKING_ADAPTIVE, extractText, cachedSystem } from "@/lib/anthropic";
import { checkAndDeductCredits, refundCredits, recordTokenUsage } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = await checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  // Validamos la entrada ANTES de cobrar: un body inválido no debe costar créditos.
  const body = await request.json().catch(() => null);
  const { channelName, channelUrl, platform, niche, subscribers } = body ?? {};
  if (typeof channelName !== "string" || !channelName.trim()) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);
  const credit = await checkAndDeductCredits(user.id, "analyze_channel");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  const userPrompt = `Analiza este canal competidor y devuelve insights estratégicos accionables:

Canal: ${channelName}
URL: ${channelUrl || "No proporcionada"}
Plataforma: ${platform}
Nicho: ${niche || "No especificado"}
Suscriptores/seguidores: ${subscribers || "Desconocido"}

Basándote en el nombre y nicho del canal, infiere sus patrones de contenido, qué lo hace exitoso y qué estrategias puedo aplicar yo.`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 3500,
      thinking: THINKING_ADAPTIVE,
      system: cachedSystem(SYSTEM_PROMPTS.analyzeChannel, userContext),
      messages: [{ role: "user", content: userPrompt }],
    });

    await recordTokenUsage(credit.logId, MODEL, message.usage);

    const raw = extractText(message);
    const analysis = JSON.parse(extractJSON(raw));

    // Save to watchlist
    await supabase.from("watchlist_channels").upsert({
      user_id: user.id,
      channel_name: channelName,
      channel_url: channelUrl || "",
      platform,
      subscribers: subscribers || "",
      niche: niche || "",
      engagement_tag: analysis.audience_insights?.slice(0, 50) || "",
    });

    return NextResponse.json({ analysis, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("analyze-channel error:", err);
    await refundCredits(user.id, "analyze_channel");
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
