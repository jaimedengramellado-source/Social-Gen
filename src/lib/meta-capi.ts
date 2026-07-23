import { createHash } from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

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
    await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
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
      }),
    });
  } catch {
    // El tracking de Meta no debe romper el login si la API de conversiones falla.
  }
}
