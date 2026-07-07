const BRAND_COLOR = "#8C2230";
const BRAND_COLOR_LIGHT = "#F7DEE2";

// Para interpolar datos del usuario (títulos de eventos, etc.) en el HTML del email.
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Devuelve true solo si Resend aceptó el email; nunca lanza (los callers corren en
// webhooks/crons donde una excepción a mitad de proceso dejaría el evento a medias).
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Social Flamingo <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend error (${res.status}) sending to ${to}:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] Resend request failed sending to ${to}:`, err);
    return false;
  }
}

const SERIF_STACK = "Georgia,'Times New Roman',Times,serif";
const SANS_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function emailLayout(opts: {
  emoji: string;
  heading: string;
  bodyHtml: string;
  ctaHref?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  const { emoji, heading, bodyHtml, ctaHref, ctaLabel, footerNote } = opts;
  return `
    <body style="margin:0;padding:0;background:#F8F7F4">
      <div style="max-width:560px;margin:0 auto;padding:48px 24px;font-family:${SANS_STACK}">
        <div style="text-align:center;margin-bottom:32px">
          <span style="font-family:${SERIF_STACK};font-size:26px;color:#0D0D0D">Social</span><span style="font-family:${SERIF_STACK};font-size:26px;font-style:italic;color:${BRAND_COLOR}">Flamingo</span>
        </div>

        <div style="background:#ffffff;border:1px solid #E5E5E5;border-radius:16px;padding:40px 32px;text-align:center">
          <div style="display:inline-block;width:56px;height:56px;line-height:56px;background:${BRAND_COLOR_LIGHT};border-radius:50%;font-size:26px;margin-bottom:20px">${emoji}</div>
          <h1 style="font-family:${SERIF_STACK};font-weight:400;font-size:22px;color:#0D0D0D;margin:0 0 12px">${heading}</h1>
          <div style="color:#6B6B6B;font-size:15px;line-height:1.6;margin:0 0 28px;text-align:center">${bodyHtml}</div>
          ${
            ctaHref
              ? `<a href="${ctaHref}"
                   style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600">
                  ${ctaLabel ?? "Ver más →"}
                </a>`
              : ""
          }
        </div>

        <div style="text-align:center;margin-top:32px">
          ${footerNote ? `<p style="color:#6B6B6B;font-size:12px;margin:0 0 6px">${footerNote}</p>` : ""}
          <p style="color:#9ca3af;font-size:12px;margin:0">Social Flamingo · <a href="https://socialflamingo.app" style="color:#9ca3af">socialflamingo.app</a></p>
        </div>
      </div>
    </body>
  `;
}
