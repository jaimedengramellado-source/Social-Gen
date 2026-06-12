export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const SYSTEM = `Eres un asistente experto en creación de contenido viral para redes sociales (YouTube, TikTok, Instagram Reels).

Ayudas a creadores con:
- Ideas virales y ángulos originales
- Guiones y hooks que enganchan desde el primer segundo
- Estrategia de contenido y calendario de publicación
- Análisis de tendencias y algoritmos de cada plataforma
- Optimización de títulos, miniaturas y descripciones
- Crecimiento de audiencia y monetización

REGLA IMPORTANTE: Cuando el usuario pida ideas de vídeo (frases como "dame ideas", "ideas para", "qué ideas", "genera ideas", "necesito ideas"), responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional antes ni después:
{"type":"ideas","ideas":[{"title":"título del vídeo","hook":"frase de apertura gancho","content_style":"Educativo|Entretenimiento|Lifestyle|Tutorial|Opinión","viral_score":85},{"title":"...","hook":"...","content_style":"...","viral_score":72}]}

Incluye entre 4 y 6 ideas. El viral_score es un número del 1 al 100.

Para cualquier otra pregunta o petición (estrategia, guiones, consejos, hooks individuales, análisis), responde en español con texto normal usando markdown cuando sea útil.
No seas genérico: da consejos accionables y específicos.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages } = await request.json();

  type IncomingMessage = {
    role: "user" | "assistant";
    content: string;
    attachment?: { url: string; mime_type: string };
  };

  const transformed = (messages as IncomingMessage[]).map(m => {
    if (m.role === "user" && m.attachment?.url && m.attachment.mime_type.startsWith("image/")) {
      return {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "url" as const, url: m.attachment.url } },
          { type: "text" as const, text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const stream = await getAnthropicClient().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM,
    messages: transformed,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
