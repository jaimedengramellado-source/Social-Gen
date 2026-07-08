import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, THINKING_ADAPTIVE_VISIBLE, extractText, cachedSystem } from "@/lib/anthropic";

// Una sola consulta gratuita por visitante: sin cuenta, el demo no debe servir
// como chat ilimitado aunque la respuesta se muestre recortada.
const DEMO_LIMIT = 1;
const DEMO_WINDOW_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "sg_demo";

// Secondary in-memory guard per serverless instance
const ipMap = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
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

const LIMIT_MESSAGE = "Ya has usado tu consulta gratuita. Crea tu cuenta para seguir generando ideas — es gratis.";

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
      return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
    }
    if (withinWindow) {
      newCount = cookieData.count + 1;
      firstCallAt = cookieData.firstCallAt;
    }
  }

  // IP-based check (catches bots that ignore cookies). Sin cabecera de proxy (dev local
  // sin forwarding, o un proxy que no la envía) no podemos distinguir visitantes reales —
  // aplicar el límite ahí juntaría a todo el mundo en un mismo cubo. En Vercel/producción
  // x-forwarded-for siempre viene informado, así que esto no debilita la protección real.
  if (ip && !checkIpLimit(ip)) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  const { prompt } = await req.json();

  if (!prompt?.trim() || prompt.trim().length < 5) {
    return NextResponse.json({ error: "Cuéntame un poco más sobre tu idea." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();
  const encoder = new TextEncoder();

  // NDJSON: {"type":"thinking","text":...} en directo, luego {"type":"result","data":...}
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          // Thinking visible sin tope de esfuerzo: el resumen del razonamiento se
          // retransmite al hero como demostración en vivo de lo que hace la IA, y
          // queremos la mejor idea posible, no la más rápida. max_tokens generoso
          // para que el pensamiento nunca corte el JSON final; streaming evita timeouts.
          thinking: THINKING_ADAPTIVE_VISIBLE,
          output_config: { effort: "high" },
          messages: [{ role: "user", content: prompt.trim() }],
          system: cachedSystem(SYSTEM_PROMPTS.script + `

TAREA ESPECÍFICA: El usuario te da un tema o contexto. Genera un mini-análisis que demuestre valor inmediato: 3 ideas de vídeo con potencial viral + el inicio del guion de la mejor idea.

Responde SOLO con este JSON (sin markdown, sin texto extra):
{
  "plataforma": "La más adecuada para este nicho. SOLO el nombre, sin explicación: YouTube | TikTok | Reels | YouTube Shorts",
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

        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = event.delta as any;
            if (d.type === "thinking_delta" && d.thinking) {
              send({ type: "thinking", text: d.thinking });
            }
          }
        }

        const message = await stream.finalMessage();
        const raw = extractText(message);
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) {
            try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
          }
        }

        if (parsed) {
          send({ type: "result", data: parsed });
        } else {
          console.error(
            `[demo] Failed to parse AI response (stop_reason=${message.stop_reason}, output_tokens=${message.usage.output_tokens}):`,
            cleaned.slice(0, 500)
          );
          send({ type: "error", message: "Error generando el análisis. Inténtalo de nuevo." });
        }
      } catch (err) {
        console.error("[demo] Anthropic API error:", err);
        try {
          send({ type: "error", message: "La IA no está disponible ahora mismo. Inténtalo de nuevo en unos segundos." });
        } catch { /* controller ya cerrado */ }
      }

      controller.close();
    },
  });

  const response = new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
  const cookie = encodeCookie({ count: newCount, firstCallAt });
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookie}; Path=/; Max-Age=${DEMO_WINDOW_MS / 1000}; HttpOnly; SameSite=Lax`
  );
  return response;
}

