import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, THINKING_ADAPTIVE, extractText, cachedSystem } from "@/lib/anthropic";

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

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    thinking: THINKING_ADAPTIVE,
    messages: [{ role: "user", content: prompt.trim() }],
    system: cachedSystem(SYSTEM_PROMPTS.script + `

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
}`),
  });

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
