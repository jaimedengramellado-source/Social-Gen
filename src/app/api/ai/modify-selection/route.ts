import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, fetchUserAIContext, THINKING_ADAPTIVE, extractText, cachedSystem } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";

const MODIFY_SELECTION_SYSTEM = `Eres un editor de texto experto en contenido viral para redes sociales. Tu única tarea es modificar un fragmento específico dentro de un mensaje ya generado, dejando el resto del mensaje EXACTAMENTE igual.

REGLAS:
- Recibes el mensaje completo en markdown y el fragmento exacto que el usuario ha seleccionado dentro de ese mensaje.
- Solo debes cambiar el fragmento seleccionado. Todo lo demás (antes y después) debe permanecer carácter por carácter idéntico: mismo markdown, mismos saltos de línea, mismos espacios.
- Si el usuario da instrucciones, aplícalas exactamente al fragmento.
- Si NO da instrucciones, mejora el fragmento aplicando principios de contenido viral: más específico, más directo, más impactante — sin cambiar su significado central ni su longitud aproximada.
- El fragmento nuevo debe encajar gramaticalmente con el texto que lo rodea.
- Nunca añadas comentarios, explicaciones ni texto fuera del mensaje modificado. Nunca digas qué has cambiado.

Responde ÚNICAMENTE con JSON válido, sin texto adicional: {"content": "mensaje completo con el fragmento ya modificado", "replacement": "el texto nuevo del fragmento, tal y como se ve renderizado (sin símbolos de markdown como ** o _), exactamente como quedó insertado en el mensaje"}`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const rl = await checkRateLimit(user.id, 15);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const { content, selection, instruction } = await request.json();

  if (typeof content !== "string" || typeof selection !== "string" || !content.trim() || !selection.trim()) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);

  const userPrompt = `Mensaje completo:
"""
${content}
"""

Fragmento seleccionado a modificar:
"""
${selection}
"""

Instrucción del usuario: ${typeof instruction === "string" && instruction.trim() ? instruction.trim() : "Ninguna — mejora el fragmento aplicando principios de contenido viral sin cambiar su significado ni su longitud aproximada."}`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 8192,
      thinking: THINKING_ADAPTIVE,
      system: cachedSystem(MODIFY_SELECTION_SYSTEM, userContext),
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = extractText(message);
    let newContent: string;
    let replacement: string;
    try {
      const parsed = JSON.parse(extractJSON(raw));
      newContent = typeof parsed.content === "string" ? parsed.content : "";
      replacement = typeof parsed.replacement === "string" ? parsed.replacement : "";
    } catch {
      newContent = "";
      replacement = "";
    }

    if (!newContent.trim()) {
      return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ content: newContent, replacement });
  } catch (err) {
    console.error("modify-selection error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
