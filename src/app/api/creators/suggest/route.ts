import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";

const SUGGESTIONS_INBOX = "service@socialflamingo.app";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre del creador es obligatorio." }, { status: 400 });
  }
  if (name.length > 120 || reason.length > 1000) {
    return NextResponse.json({ error: "Nombre (máx. 120) o mensaje (máx. 1000) demasiado largos." }, { status: 400 });
  }

  const sent = await sendEmail(
    SUGGESTIONS_INBOX,
    `Sugerencia de creador: ${name}`,
    emailLayout({
      emoji: "💡",
      heading: "Nueva sugerencia de creador",
      bodyHtml: `
        <p style="margin:0 0 8px"><strong>Creador sugerido:</strong> ${escapeHtml(name)}</p>
        ${reason ? `<p style="margin:0 0 8px"><strong>Mensaje:</strong> ${escapeHtml(reason)}</p>` : ""}
        <p style="margin:0"><strong>Usuario:</strong> ${escapeHtml(user.email ?? user.id)}</p>
      `,
      footerNote: "Sugerencia enviada desde el chat de /crear.",
    })
  );

  if (!sent) {
    return NextResponse.json({ error: "No se pudo enviar la sugerencia. Inténtalo de nuevo más tarde." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
