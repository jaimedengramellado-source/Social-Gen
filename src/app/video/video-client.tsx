"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clapperboard, Download, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { Profile, VideoRender } from "@/types";
import { CREDIT_COSTS } from "@/types";
import { VIDEO_DURATIONS, VIDEO_TEMPLATES } from "@/lib/video/templates";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { timeAgo } from "@/lib/utils";

interface Props {
  profile: Profile;
  initialRenders: VideoRender[];
}

const STATUS_LABELS: Record<VideoRender["status"], string> = {
  queued: "En cola",
  rendering: "Generando…",
  done: "Listo",
  error: "Error",
};

export function VideoClient({ profile, initialRenders }: Props) {
  const [instructions, setInstructions] = useState("");
  const [template, setTemplate] = useState<string>("auto");
  const [duration, setDuration] = useState<number>(0); // 0 = automático
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<VideoRender[]>(initialRenders);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(profile.credits_remaining);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasActive = renders.some((r) => r.status === "queued" || r.status === "rendering");

  // Mientras haya renders en curso, refresca la lista: el worker externo es
  // quien cambia queued → rendering → done.
  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/video/renders");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.renders)) setRenders(data.renders);
      } catch {
        // siguiente tick
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hasActive]);

  async function handleGenerate() {
    const text = instructions.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/video/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: text,
          template: template === "auto" ? undefined : template,
          durationSeconds: duration || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setCreditsRemaining(data.creditsRemaining ?? 0);
        setShowUpgrade(true);
        return;
      }
      if (res.status === 429) {
        setError("Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo.");
        return;
      }
      if (!res.ok || !data.render) {
        setError("No se pudo generar la animación. No se han gastado créditos, vuelve a intentarlo.");
        return;
      }
      setRenders((prev) => [data.render, ...prev]);
      setCreditsRemaining(data.creditsRemaining ?? creditsRemaining);
      setInstructions("");
    } catch {
      setError("Error de conexión. Vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl md:text-4xl font-normal mb-2"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Anima tus{" "}
          <span style={{ fontStyle: "italic", color: "var(--color-primary)" }}>ideas</span>
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Describe lo que quieres y la IA lo convierte en una animación vertical lista para TikTok, Reels o Shorts.
        </p>
      </div>

      {/* Formulario */}
      <div
        className="rounded-2xl border bg-[var(--color-card)] p-5 md:p-6 mb-10"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="rounded-xl border transition-all focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(140,34,48,0.08)]"
          style={{ borderColor: "var(--color-border)" }}
        >
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ej.: una animación con el hook de mi último guion sobre rutinas de mañana, en plan misterioso..."
            rows={3}
            maxLength={1000}
            disabled={loading}
            className="w-full px-4 py-3 text-sm rounded-xl resize-none outline-none bg-transparent disabled:opacity-50"
            style={{ color: "var(--color-foreground)" }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)] mr-1">Plantilla:</span>
          <button
            onClick={() => setTemplate("auto")}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            style={
              template === "auto"
                ? { backgroundColor: "var(--color-primary-light)", borderColor: "var(--color-primary-light)", color: "var(--color-primary)" }
                : { borderColor: "var(--color-border)", color: "var(--color-foreground)" }
            }
          >
            <Wand2 size={12} strokeWidth={2} />
            Automática
          </button>
          {VIDEO_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              title={t.description}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                template === t.id
                  ? { backgroundColor: "var(--color-primary-light)", borderColor: "var(--color-primary-light)", color: "var(--color-primary)" }
                  : { borderColor: "var(--color-border)", color: "var(--color-foreground)" }
              }
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)] mr-1">Duración:</span>
          {[0, ...VIDEO_DURATIONS].map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                duration === d
                  ? { backgroundColor: "var(--color-primary-light)", borderColor: "var(--color-primary-light)", color: "var(--color-primary)" }
                  : { borderColor: "var(--color-border)", color: "var(--color-foreground)" }
              }
            >
              {d === 0 ? "Auto" : `${d}s`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-5">
          <button
            onClick={handleGenerate}
            disabled={loading || !instructions.trim()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} strokeWidth={2} />}
            {loading ? "Preparando..." : "Generar animación"}
          </button>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {CREDIT_COSTS.generate_video} créditos por vídeo
            {creditsRemaining !== null ? ` · te quedan ${creditsRemaining}` : ""}
          </span>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs mt-3" style={{ color: "var(--color-destructive)" }}>
            <AlertCircle size={13} />
            {error}
          </p>
        )}
      </div>

      {/* Historial */}
      {renders.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-10 text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Clapperboard size={24} strokeWidth={1.6} className="mx-auto mb-3" style={{ color: "var(--color-muted-foreground)" }} />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Tus animaciones aparecerán aquí. Genera la primera describiendo lo que quieres arriba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {renders.map((render) => (
            <div
              key={render.id}
              className="rounded-2xl border bg-[var(--color-card)] overflow-hidden"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="relative aspect-[9/16] bg-[var(--color-muted)]">
                {render.status === "done" && render.video_url ? (
                  <video
                    src={render.video_url}
                    controls
                    preload="metadata"
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    {render.status === "error" ? (
                      <>
                        <AlertCircle size={22} style={{ color: "var(--color-destructive)" }} />
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          El render falló y te hemos devuelto los créditos. Vuelve a intentarlo.
                        </p>
                      </>
                    ) : (
                      <>
                        <Loader2 size={22} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {render.status === "queued"
                            ? "En cola, empezará en unos segundos..."
                            : "Renderizando tu animación..."}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={
                      render.status === "done"
                        ? { backgroundColor: "#ECFDF5", color: "var(--color-success)" }
                        : render.status === "error"
                          ? { backgroundColor: "#FEF2F2", color: "var(--color-destructive)" }
                          : { backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }
                    }
                  >
                    {STATUS_LABELS[render.status]}
                  </span>
                  <span className="text-[11px] text-[var(--color-muted-foreground)]">
                    {timeAgo(render.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-foreground)] line-clamp-2 mb-2">
                  {render.instructions}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-muted-foreground)]">
                    {VIDEO_TEMPLATES.find((t) => t.id === render.template)?.name ?? render.template} · {render.duration_seconds}s
                  </span>
                  {render.status === "done" && render.video_url && (
                    <a
                      href={render.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: "var(--color-primary)" }}
                    >
                      <Download size={12} />
                      Descargar
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        creditsRemaining={creditsRemaining ?? 0}
        plan={profile.plan}
      />
    </div>
  );
}
