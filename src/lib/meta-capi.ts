import { createHash } from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
// Solo para verificar en Events Manager → Eventos de prueba; quitar la env var
// una vez confirmado (el código de prueba de Meta caduca solo, pero mejor no
// dejarlo puesto indefinidamente).
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;

function hashField(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendMetaCapiEvent(params: {
  eventName: string;
  eventSourceUrl: string;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}) {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const userData: Record<string, unknown> = {};
  if (params.email) userData.em = [hashField(params.email)];
  if (params.ip) userData.client_ip_address = params.ip;
  if (params.userAgent) userData.client_user_agent = params.userAgent;
  if (params.fbp) userData.fbp = params.fbp;
  if (params.fbc) userData.fbc = params.fbc;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: params.eventName,
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            event_source_url: params.eventSourceUrl,
            user_data: userData,
          },
        ],
        ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Meta CAPI event rejected:", params.eventName, await res.text());
    }
  } catch (err) {
    // El tracking de Meta no debe romper el login si la API de conversiones falla.
    console.error("Meta CAPI event failed:", params.eventName, err);
  }
}
