import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, fetchUserAIContext, THINKING_ADAPTIVE, extractText, cachedSystem } from "@/lib/anthropic";
import { checkAndDeductCredits, refundCredits, recordTokenUsage } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";

// Structured outputs: la API garantiza que la respuesta valida contra este schema, así
// que el JSON.parse ya no puede reventar por una comilla sin escapar o texto extra
// (causa real de AI_ERROR en producción, ver logs del 2026-07-16). Sin minItems ni
// minimum/maximum — structured outputs no los soporta; los rangos se ajustan en código.
const SURPRISE_IDEAS_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título listo para usar, máx 70 caracteres. Imposible de no hacer clic." },
          description: { type: "string", description: "2-3 frases que desarrollan el ángulo único. Máx 150 caracteres." },
          viral_score: { type: "integer", description: "Puntuación de potencial viral entre 1 y 100." },
          hook_type: { type: "string", enum: ["Curiosidad", "Shock", "Identidad", "Miedo", "Contrarian", "Revelación", "Transformación", "Morbo", "FOMO"] },
          content_style: { type: "string", enum: ["Educativo", "Entretenimiento", "Motivacional", "Humor", "Polémico", "Tutorial", "Documental", "Experimento"] },
        },
        required: ["title", "description", "viral_score", "hook_type", "content_style"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = await checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
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
    // Sin esto, el timeout por defecto del SDK es de 10 minutos y además reintenta
    // internamente — un fallo real puede tardar varios minutos en manifestarse y la
    // UI se percibe como colgada. Con maxRetries: 0 un fallo se resuelve en <60s: el
    // usuario puede simplemente volver a pulsar el botón.
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      // El thinking adaptativo consume del mismo tope que la respuesta: con 3500 el
      // JSON llegaba truncado a veces. 8000 iguala al endpoint principal de ideas.
      max_tokens: 8000,
      thinking: THINKING_ADAPTIVE,
      system: cachedSystem(SYSTEM_PROMPTS.ideas, userContext),
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema: SURPRISE_IDEAS_SCHEMA } },
    }, { timeout: 60000, maxRetries: 0 });

    await recordTokenUsage(credit.logId, MODEL, message.usage);

    if (message.stop_reason === "max_tokens" || message.stop_reason === "refusal") {
      throw new Error(`unexpected stop_reason: ${message.stop_reason}`);
    }

    const parsed = JSON.parse(extractText(message)) as { ideas: Array<Record<string, unknown>> };

    const ideas = (parsed.ideas ?? [])
      .slice(0, 5)
      .map((idea) => ({
        title: String(idea.title ?? ""),
        description: String(idea.description ?? ""),
        viral_score: Math.min(100, Math.max(1, Math.round(Number(idea.viral_score) || 70))),
        hook_type: String(idea.hook_type ?? ""),
        content_style: String(idea.content_style ?? ""),
      }))
      .filter((idea) => idea.title);

    if (ideas.length === 0) {
      throw new Error("model returned no ideas");
    }

    const toInsert = ideas.map((idea) => ({
      user_id: user.id,
      channel_id: channel?.id || null,
      ...idea,
      platform: platformHint,
      format: "surprise",
      niche: nicheHint,
      is_saved: false,
    }));

    const { data: saved, error: insertError } = await supabase.from("ideas").insert(toInsert).select();
    // Si el insert falla se devuelven las ideas sin id igualmente: el dashboard ya no
    // depende del id para abrir el chat, solo se pierde el histórico en BD.
    if (insertError) console.error("sorprendeme insert error:", insertError.message);

    return NextResponse.json({
      ideas: saved ?? ideas,
      creditsRemaining: credit.creditsRemaining,
    });
  } catch (err) {
    console.error("sorprendeme error:", err);
    await refundCredits(user.id, "sorprendeme");
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
