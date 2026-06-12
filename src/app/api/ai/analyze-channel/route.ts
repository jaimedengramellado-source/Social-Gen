import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS } from "@/lib/anthropic";
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

  const credit = await checkAndDeductCredits(user.id, "analyze_channel");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  const body = await request.json();
  const { channelName, channelUrl, platform, niche, subscribers } = body;

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
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.analyzeChannel,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
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
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
