import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, THINKING_DISABLED, extractText, cachedSystem } from "@/lib/anthropic";

const DEMO_LIMIT = 3;
const DEMO_WINDOW_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "sg_demo";

// Secondary in-memory guard per serverless instance
const ipMap = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
    return true;
  }
  if (entry.count >= DEMO_LIMIT) return false;
  entry.count++;
  return true;
}

function readCookie(req: NextRequest): { count: number; firstCallAt: number } | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function encodeCookie(data: { count: number; firstCallAt: number }): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  // Cookie-based check (persists across serverless instances)
  const now = Date.now();
  const cookieData = readCookie(req);
  let newCount = 1;
  let firstCallAt = now;

  if (cookieData) {
    const withinWindow = now - cookieData.firstCallAt < DEMO_WINDOW_MS;
    if (withinWindow && cookieData.count >= DEMO_LIMIT) {
      return NextResponse.json(
        { error: "Has alcanzado el límite del demo gratuito. Crea tu cuenta para continuar." },
        { status: 429 }
      );
    }
    if (withinWindow) {
      newCount = cookieData.count + 1;
      firstCallAt = cookieData.firstCallAt;
    }
  }

  // IP-based check (catches bots that ignore cookies)
  if (!checkIpLimit(ip)) {
    return NextResponse.json(
      { error: "Has alcanzado el límite del demo gratuito. Crea tu cuenta para continuar." },
      { status: 429 }
    );
  }

  const { prompt } = await req.json();

  if (!prompt?.trim() || prompt.trim().length < 5) {
    return NextResponse.json({ error: "Cuéntame un poco más sobre tu idea." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  let message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      // Sin thinking: el demo de la landing prioriza latencia; con thinking adaptativo
      // el razonamiento consumía el presupuesto de tokens y el JSON llegaba truncado.
      thinking: THINKING_DISABLED,
      messages: [{ role: "user", content: prompt.trim() }],
      system: cachedSystem(SYSTEM_PROMPTS.script + `

TAREA ESPECÍFICA: El usuario te da un tema o contexto. Genera un mini-análisis que demuestre valor inmediato: 3 ideas de vídeo con potencial viral + el inicio del guion de la mejor idea.

Responde SOLO con este JSON (sin markdown, sin texto extra):
{
  "plataforma": "YouTube / TikTok / Reels — la más adecuada para este nicho",
  "ideas": [
    {
      "title": "Título listo para usar, máx 70 caracteres. Imposible de no hacer clic.",
      "viral_score": <1-100, sé realista: entre 60 y 95>,
      "hook_type": "Curiosidad|Shock|Identidad|Miedo|Contrarian|Revelación|Transformación|FOMO",
      "why_viral": "La palanca psicológica exacta que hace irresistible esta idea, en 1 frase"
    },
    { ...idea 2 }, { ...idea 3 }
  ],
  "hook": "Primera frase exacta del guion de la idea 1. Para el scroll en 2 segundos.",
  "intro": "Los siguientes 25-30 segundos del guion de la idea 1: desarrolla el loop de curiosidad, promete el valor, no lo entregues todavía.",
  "por_que": "Por qué este hook funciona psicológicamente, en 1 frase"
}
Las ideas van ordenadas de mayor a menor viral_score. Exactamente 3 ideas.`),
    });
  } catch (err) {
    console.error("[demo] Anthropic API error:", err);
    return NextResponse.json(
      { error: "La IA no está disponible ahora mismo. Inténtalo de nuevo en unos segundos." },
      { status: 500 }
    );
  }

  const raw = extractText(message);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  const response = (() => {
    try {
      return NextResponse.json(JSON.parse(cleaned));
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { return NextResponse.json(JSON.parse(match[0])); } catch { /* fall through */ }
      }
      console.error(
        `[demo] Failed to parse AI response (stop_reason=${message.stop_reason}, output_tokens=${message.usage.output_tokens}):`,
        cleaned.slice(0, 500)
      );
      return NextResponse.json({ error: "Error generando el guion." }, { status: 500 });
    }
  })();

  response.cookies.set(COOKIE_NAME, encodeCookie({ count: newCount, firstCallAt }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: DEMO_WINDOW_MS / 1000,
    path: "/",
  });

  return response;
}
