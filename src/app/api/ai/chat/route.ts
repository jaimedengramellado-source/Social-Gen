export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, VIRAL_CORE } from "@/lib/anthropic";

const PLATFORM_LABELS: Record<string, string> = {
  youtube_long: "YouTube (vídeo largo, 8-20 minutos)",
  youtube_shorts: "YouTube Shorts (menos de 60 segundos)",
  tiktok: "TikTok (15-90 segundos)",
  reels: "Instagram Reels (menos de 90 segundos)",
};

function buildChatSystem(channel: { platform: string; niche: string; niche_description?: string | null } | null): string {
  const platformLabel = channel ? (PLATFORM_LABELS[channel.platform] ?? channel.platform) : "redes sociales";

  const contextBlock = channel
    ? `El creador con quien hablas tiene el siguiente canal:
- Plataforma: ${platformLabel}
- Nicho: ${channel.niche}${channel.niche_description ? `\n- Descripción: ${channel.niche_description}` : ""}

Usa este contexto en TODAS tus respuestas. Adapta siempre tus consejos, ideas y estrategias a este nicho y plataforma específicos. Nunca des consejos genéricos que no apliquen directamente a este creador.`
    : `El creador aún no ha configurado su canal. Responde de forma útil y cuando sea relevante pregúntale por su nicho y plataforma para poder ayudarle mejor.`;

  return `${VIRAL_CORE}
═══ MODO CHAT CONVERSACIONAL ═══

${contextBlock}

REGLA IDEAS: Cuando el usuario pida ideas de vídeo (frases como "dame ideas", "ideas para", "qué ideas", "genera ideas", "necesito ideas", "propóname ideas", "brainstorming"), responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional antes ni después:
{"type":"ideas","ideas":[{"title":"título del vídeo (máx 70 chars)","hook":"frase de apertura gancho de 0-1.5s","content_style":"Educativo|Entretenimiento|Lifestyle|Tutorial|Opinión|Documental|Experimento","viral_score":85,"why_viral":"La palanca psicológica exacta que hace este concepto irresistible","hook_type":"Curiosidad|Shock|Identidad|Miedo|Contrarian|Revelación|Transformación|Morbo|FOMO","differentiator":"Qué hace esta idea irrepetible por otro creador del mismo nicho"}]}

Incluye entre 4 y 6 ideas. El viral_score es un número del 1 al 100. Aplica ESPECIFICIDAD BRUTAL: no "cómo ganar dinero" sino "cómo generé 847€ en 72 horas con esto". Las ideas deben pasar el test de premisa irresistible: el concepto solo, sin ejecución, ya genera curiosidad extrema.

REGLA GENERAL: Para cualquier otra petición (estrategia, guiones, análisis de hooks, calendario, hashtags, análisis de canal, consejos de crecimiento), responde en español con markdown cuando sea útil. Sé brutalmente específico y accionable. Nunca digas "depende" sin dar una recomendación concreta. Aplica los principios de VIRAL_CORE en cada consejo.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages } = await request.json();

  const { data: channel } = await supabase
    .from("channels")
    .select("platform, niche, niche_description")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

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
    model: MODEL,
    max_tokens: 2048,
    system: buildChatSystem(channel),
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
