import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODEL, THINKING_ADAPTIVE, VIRAL_CORE, cachedSystem, extractText } from "@/lib/anthropic";
import { VIDEO_TEMPLATES, clampDuration, getVideoTemplate, type VideoDuration } from "./templates";

// El system es idéntico entre usuarios y peticiones (breakpoint de caché en
// cachedSystem). Incluye VIRAL_CORE porque escribir el texto en pantalla de una
// animación ES escribir un hook — y de paso supera el mínimo cacheable del modelo.
const SYSTEM_PROMPT = `Eres el director creativo de Social Flamingo. Conviertes instrucciones en lenguaje natural de un creador de contenido en la configuración exacta de una plantilla de vídeo animado (formato vertical 1080x1920 para TikTok/Reels/Shorts).
${VIRAL_CORE}
═══ PLANTILLAS DISPONIBLES ═══

${VIDEO_TEMPLATES.map((t) => `— ${t.id}: ${t.description} ${t.aiGuidance}`).join("\n")}

═══ REGLAS DEL TEXTO EN PANTALLA ═══

— El texto se lee en segundos: frases cortas, palabras concretas, cero relleno.
— Aplica las palancas de hooks de arriba: especificidad brutal, curiosity gap, conflicto.
— Nunca uses comillas dobles dentro de los textos.
— El idioma del texto es el del usuario (por defecto español).
— Duración: 6s para un solo golpe de efecto, 10-15s si hay lista o más texto. Valores permitidos: 6, 10, 15.
— Si el usuario pide una plantilla concreta, respétala. Si no, elige la que mejor encaje con su instrucción.`;

const VIDEO_PROPS_SCHEMA = {
  type: "object",
  properties: {
    template: {
      type: "string",
      enum: VIDEO_TEMPLATES.map((t) => t.id),
      description: "Plantilla elegida según la instrucción del usuario.",
    },
    duration_seconds: { type: "integer", description: "Duración del vídeo: 6, 10 o 15." },
    hook: { type: "string", description: "Solo para hook-card: la frase gancho, máx 90 caracteres." },
    title: { type: "string", description: "Solo para list-card: título de la lista, máx 50 caracteres." },
    items: {
      type: "array",
      items: { type: "string" },
      description: "Solo para list-card: 3-5 elementos, máx 60 caracteres cada uno, sin numerar.",
    },
  },
  required: ["template", "duration_seconds"],
  additionalProperties: false,
};

export interface GeneratedVideoConfig {
  template: string;
  durationSeconds: VideoDuration;
  props: Record<string, unknown>;
  usage: Anthropic.Usage;
}

export async function generateVideoProps(opts: {
  instructions: string;
  forcedTemplate?: string;
  forcedDuration?: number;
  userContext: string;
  handle: string;
}): Promise<GeneratedVideoConfig> {
  const constraints: string[] = [];
  if (opts.forcedTemplate && getVideoTemplate(opts.forcedTemplate)) {
    constraints.push(`- Plantilla obligatoria: ${opts.forcedTemplate}`);
  }
  if (opts.forcedDuration) {
    constraints.push(`- Duración obligatoria: ${clampDuration(opts.forcedDuration)} segundos`);
  }

  const userPrompt = `Instrucción del creador para su animación:
"""
${opts.instructions}
"""
${constraints.length > 0 ? `\nRestricciones:\n${constraints.join("\n")}` : ""}`;

  // timeout corto + sin reintentos, como el resto de endpoints JSON: un fallo se
  // resuelve rápido y el usuario reintenta (ver sorprendeme/route.ts).
  const message = await getAnthropicClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: THINKING_ADAPTIVE,
    system: cachedSystem(SYSTEM_PROMPT, opts.userContext),
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: VIDEO_PROPS_SCHEMA } },
  }, { timeout: 60000, maxRetries: 0 });

  if (message.stop_reason === "max_tokens" || message.stop_reason === "refusal") {
    throw new Error(`unexpected stop_reason: ${message.stop_reason}`);
  }

  const parsed = JSON.parse(extractText(message)) as {
    template: string;
    duration_seconds: number;
    hook?: string;
    title?: string;
    items?: string[];
  };

  const template = getVideoTemplate(opts.forcedTemplate ?? "") ? opts.forcedTemplate! : parsed.template;
  const durationSeconds = clampDuration(opts.forcedDuration ?? parsed.duration_seconds);

  let props: Record<string, unknown>;
  if (template === "hook-card") {
    const hook = (parsed.hook ?? "").trim();
    if (!hook) throw new Error("model returned no hook for hook-card");
    props = { hook: hook.slice(0, 120), handle: opts.handle };
  } else if (template === "list-card") {
    const title = (parsed.title ?? "").trim();
    const items = (parsed.items ?? []).map((i) => String(i).trim()).filter(Boolean).slice(0, 5);
    if (!title || items.length < 2) throw new Error("model returned incomplete list-card props");
    props = { title: title.slice(0, 70), items, handle: opts.handle };
  } else {
    throw new Error(`unknown template: ${template}`);
  }

  return { template, durationSeconds, props, usage: message.usage };
}
