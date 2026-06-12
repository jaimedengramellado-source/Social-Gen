import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt?.trim() || prompt.trim().length < 5) {
    return NextResponse.json({ error: "Cuéntame un poco más sobre tu idea." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt.trim() }],
    system: SYSTEM_PROMPTS.script + `

TAREA ESPECÍFICA: El usuario te da un tema o contexto. Genera el inicio de un guion que pare el scroll y obligue a seguir viendo.

Responde SOLO con este JSON (sin markdown, sin texto extra):
{
  "hook": "Primera frase exacta que se dice en cámara. Para el scroll en 2 segundos.",
  "intro": "Los siguientes 25-30 segundos: desarrolla el loop de curiosidad, promete el valor, no lo entregues todavía.",
  "plataforma": "YouTube / TikTok / Reels",
  "por_que": "La palanca psicológica exacta que hace irresistible este hook (curiosidad, miedo, identidad, shock, contrarian)",
  "visuales": [
    { "momento": "Hook (0-2s)", "tipo": "entorno/acción/pantalla/encuadre", "descripcion": "qué se ve exactamente: plano, posición del creador, elementos en escena, texto en pantalla" },
    { "momento": "Apertura (2-15s)", "tipo": "entorno/acción/pantalla/encuadre", "descripcion": "qué cambia, cómo evoluciona la escena, movimiento de cámara" },
    { "momento": "Loop (15-30s)", "tipo": "entorno/acción/pantalla/encuadre", "descripcion": "el momento visual que refuerza la promesa y retiene al espectador" }
  ]
}`,
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    // Last resort: try to extract JSON object from the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const data = JSON.parse(match[0]);
        return NextResponse.json(data);
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: "Error generando el guion." }, { status: 500 });
  }
}
