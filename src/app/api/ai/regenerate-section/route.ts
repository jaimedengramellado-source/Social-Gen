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

  const credit = await checkAndDeductCredits(user.id, "regenerate_section");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  const body = await request.json();
  const { scriptId, section, currentContent, context } = body;

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
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    let newContent: string;

    try {
      const parsed = JSON.parse(extractJSON(raw));
      newContent = parsed.content;
    } catch {
      newContent = raw.trim();
    }

    // Update script in DB if scriptId provided
    if (scriptId && section !== "main_content") {
      await supabase
        .from("scripts")
        .update({ [section]: newContent, updated_at: new Date().toISOString() })
        .eq("id", scriptId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ content: newContent, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("regenerate-section error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
