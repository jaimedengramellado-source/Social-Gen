import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markdownToTiptap } from "@/lib/markdown-to-tiptap";
import { getAnthropicClient, MODEL, THINKING_DISABLED, cachedSystem, extractText } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rate-limit";

// El chat muestra los guiones con encabezados normales (## Hook / ## Intro / ...) para no
// romper el formato de lectura habitual. Solo al exportar a Documentos se reformatea a
// escaleta de documental (tabla Tiempo | Descripción | Diálogo) — ver AGENTS.md.
const ESCALETA_CONVERTER_SYSTEM = `Eres un conversor de formato para una app de creación de contenido. Recibes un mensaje en markdown generado por un asistente de IA para creadores de TikTok/Instagram/YouTube, justo antes de guardarlo como documento.

Si el contenido es un guion completo de vídeo (tiene hook, bloques de desarrollo con timestamps, diálogo a cámara, CTA final, etc., normalmente bajo encabezados como ## Hook / ## Intro / ## Desarrollo / ## CTA), conviértelo a formato de escaleta de documental:
1. Mantén (o crea) un "## " con el título del vídeo al principio.
2. Justo debajo, una única tabla Markdown con EXACTAMENTE estas 3 columnas: Tiempo | Descripción | Diálogo. Una fila por cada beat del guion (hook, intro, cada bloque del desarrollo con timestamps acumulados coherentes, y CTA final).
   - Columna "Tiempo": rango del beat, ej. "0:00-0:03".
   - Columna "Descripción": encuadre, movimiento de cámara, acción en pantalla, corte o elemento visual — nunca la dejes vacía ni genérica ("primer plano" no vale, especifica qué se ve y cómo se mueve la cámara).
   - Columna "Diálogo": el texto EXACTO a decir, entre comillas cuando sea una frase literal a cámara.
3. No dejes encabezados ## Hook / ## Intro / ## Desarrollo / ## CTA separados — todo el guion va en la tabla.
4. Quita cualquier frase final tipo "💾 Puedes exportar este guion a Documentos..." (ya se está exportando).

Si el contenido NO es un guion de vídeo (son ideas, un análisis, una estrategia, texto conversacional, etc.), devuélvelo EXACTAMENTE IGUAL, sin cambiar ni una palabra.

Responde ÚNICAMENTE con el contenido final en markdown — nada de explicaciones, ni "Aquí tienes", ni bloques de código envolviendo la respuesta.`;

async function toDocumentMarkdown(content: string): Promise<string> {
  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: THINKING_DISABLED,
      system: cachedSystem(ESCALETA_CONVERTER_SYSTEM),
      messages: [{ role: "user", content }],
    });
    const text = extractText(message).trim();
    return text || content;
  } catch {
    return content;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Este endpoint hace una llamada a la IA sin cobrar créditos, así que limitamos la
  // frecuencia para que no se pueda abusar y disparar nuestro coste de Anthropic.
  const rl = await checkRateLimit(user.id, 10);
  if (!rl.ok) return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });

  const body = await request.json().catch(() => ({})) as { content?: unknown; title?: unknown };
  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json({ error: "content requerido" }, { status: 400 });
  }

  const docTitle = (typeof body.title === "string" ? body.title : "").trim().slice(0, 100) || "Contenido generado";
  const docMarkdown = await toDocumentMarkdown(body.content);
  const tiptapContent = markdownToTiptap(docMarkdown);

  const { data, error } = await supabase
    .from("scripts")
    .insert({
      user_id: user.id,
      title: docTitle,
      status: "draft",
      credits_used: 0,
      content: tiptapContent,
    })
    .select("id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, title: data.title });
}
