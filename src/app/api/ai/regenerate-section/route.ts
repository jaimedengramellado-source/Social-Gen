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
  const { scriptId, section, currentContent, context } = body ?? {};
  if (typeof section !== "string" || !section || typeof currentContent !== "string") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);
  const credit = await checkAndDeductCredits(user.id, "regenerate_section");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  const systemPrompt = SYSTEM_PROMPTS.script + `

TAREA ESPECÍFICA: Regenera ÚNICAMENTE la sección indicada. Aplica todo tu conocimiento sobre retención, hooks, open loops, show don't tell y palancas psicológicas para hacer esta sección más potente que la original. Responde SOLO con JSON: {"content": "nuevo texto de la sección"}`;

  const userPrompt = `Regenera esta sección del guion. Hazla más impactante, más específica y más viral que la original:

Sección: ${section.toUpperCase()}
Texto actual: "${currentContent}"
Contexto del guion completo: ${context || "No disponible"}

Mejora el impacto sin perder el hilo narrativo con el resto del guion. Solo devuelve el texto nuevo.`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: THINKING_ADAPTIVE,
      system: cachedSystem(systemPrompt, userContext),
      messages: [{ role: "user", content: userPrompt }],
    });

    await recordTokenUsage(credit.logId, MODEL, message.usage);

    const raw = extractText(message);
    let newContent: string;

    try {
      const parsed = JSON.parse(extractJSON(raw));
      newContent = parsed.content;
    } catch {
      newContent = raw.trim();
    }

    // Solo columnas de texto del guion: `section` viene del cliente y sin esta
    // whitelist podría usarse para escribir cualquier columna de la fila (mass assignment).
    const UPDATABLE_SECTIONS = new Set(["hook", "intro", "cta"]);
    if (scriptId && UPDATABLE_SECTIONS.has(section)) {
      await supabase
        .from("scripts")
        .update({ [section]: newContent, updated_at: new Date().toISOString() })
        .eq("id", scriptId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ content: newContent, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("regenerate-section error:", err);
    await refundCredits(user.id, "regenerate_section");
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
