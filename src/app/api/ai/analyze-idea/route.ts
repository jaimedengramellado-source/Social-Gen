import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, THINKING_ADAPTIVE, extractText, cachedSystem } from "@/lib/anthropic";
import { checkAndDeductCredits, refundCredits, recordTokenUsage } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rl = await checkRateLimit(user.id);
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });

  // Validamos y construimos el prompt ANTES de cobrar: si la entrada es inválida no
  // queremos descontar un crédito al usuario y devolverle un 500.
  const body = await req.json().catch(() => null);
  const query = body?.query;
  const videos = body?.videos;
  if (typeof query !== "string" || !query.trim() || !Array.isArray(videos)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const videoList = (videos as { title?: string; views?: number; publishedAt?: string }[])
    .slice(0, 10)
    .map((v, i) => {
      const views = typeof v?.views === "number" ? v.views.toLocaleString() : "?";
      const date = v?.publishedAt ? new Date(v.publishedAt).toLocaleDateString("es-ES") : "?";
      return `${i + 1}. "${v?.title ?? "Sin título"}" — ${views} vistas — ${date}`;
    })
    .join("\n");

  const userPrompt = `Idea de vídeo: "${query}"\n\nVídeos que ya existen sobre esta idea (ordenados por vistas):\n${videoList}\n\nAnaliza qué ha funcionado y genera los mejores insights para crear el vídeo definitivo sobre esta idea.`;

  const credit = await checkAndDeductCredits(user.id, "analyze_idea");
  if (!credit.ok) return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 3000,
      thinking: THINKING_ADAPTIVE,
      system: cachedSystem(SYSTEM_PROMPTS.analyzeIdea),
      messages: [{ role: "user", content: userPrompt }],
    });

    await recordTokenUsage(credit.logId, MODEL, message.usage);

    const raw = extractText(message);
    const analysis = JSON.parse(extractJSON(raw));
    return NextResponse.json({ analysis, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("analyze-idea error:", err);
    await refundCredits(user.id, "analyze_idea");
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
