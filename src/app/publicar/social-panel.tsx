"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Loader2, Check, X, Film, CalendarDays, PenLine, ChevronDown,
  Sparkles, AtSign, Music2, Unplug,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Snippet, SocialConnection } from "@/types";
import { formatBytes, formatDateTime, toLocalInputValue, nextOccurrence, WEEKDAY_SHORT } from "./shared";
import type { BestSlot } from "./shared";

const MAX_FILE_BYTES = 200 * 1024 * 1024;

const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Público",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Solo yo",
};

interface Props {
  platform: "instagram" | "tiktok";
  connection: SocialConnection | null;
  bestSlots: BestSlot[] | null;
  snippets: Snippet[] | null;
  onLoadSnippets: () => void;
  refreshPosts: () => void;
  onDisconnected: () => void;
}

export function SocialPanel({
  platform, connection, bestSlots, snippets, onLoadSnippets, refreshPosts, onDisconnected,
}: Props) {
  const isInstagram = platform === "instagram";
  const label = isInstagram ? "Instagram" : "TikTok";
  const PlatformIcon = isInstagram ? AtSign : Music2;

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("schedule");
  const [scheduledAt, setScheduledAt] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("PUBLIC_TO_EVERYONE");
  const [showSnippets, setShowSnippets] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const snippetsMenuRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const tiktokPrivacyOptions = useMemo(() => {
    const creatorInfo = connection?.metadata?.creatorInfo as { privacyOptions?: string[] } | undefined;
    return creatorInfo?.privacyOptions ?? ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
  }, [connection]);

  useEffect(() => {
    if (isInstagram || tiktokPrivacyOptions.includes(privacyLevel)) return;
    setPrivacyLevel(tiktokPrivacyOptions[0] ?? "SELF_ONLY");
  }, [isInstagram, tiktokPrivacyOptions, privacyLevel]);

  useEffect(() => {
    if (!showSnippets) return;
    function onDocClick(e: MouseEvent) {
      if (snippetsMenuRef.current && !snippetsMenuRef.current.contains(e.target as Node)) {
        setShowSnippets(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showSnippets]);

  const canSubmit = useMemo(
    () =>
      Boolean(file) &&
      caption.trim().length > 0 &&
      caption.trim().length <= 2200 &&
      !submitting &&
      (mode === "now" || Boolean(scheduledAt)),
    [file, caption, submitting, mode, scheduledAt]
  );

  function pickFile(f: File | undefined | null) {
    setFormError(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setFormError("El archivo debe ser un vídeo.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFormError("El vídeo supera el máximo de 200 MB.");
      return;
    }
    setFile(f);
  }

  function insertSnippet(content: string) {
    setShowSnippets(false);
    setCaption((prev) => {
      const next = prev ? (prev.endsWith("\n") ? prev + content : `${prev}\n${content}`) : content;
      return next.slice(0, 2200);
    });
    captionRef.current?.focus();
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  }

  async function submit() {
    if (!file || !canSubmit) return;
    setFormError(null);
    setSuccessNote(null);
    setSubmitting(true);

    try {
      // 1. Vídeo al bucket (espera ahí hasta que el cron lo publique)
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión caducada. Recarga la página.");

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("publish-videos")
        .upload(storagePath, file, { contentType: file.type || "video/mp4" });
      if (uploadError) throw new Error(`No se pudo subir el vídeo: ${uploadError.message}`);

      // 2. Encolar la publicación
      const scheduledIso =
        mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const res = await fetch("/api/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          title: caption.trim(),
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          scheduledAt: scheduledIso,
          ...(isInstagram ? {} : { privacyLevel }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        await supabase.storage.from("publish-videos").remove([storagePath]).catch(() => {});
        throw new Error(json.error ?? "No se pudo crear la publicación.");
      }

      refreshPosts();
      setSuccessNote(
        scheduledIso
          ? `Programado para el ${formatDateTime(scheduledIso)}. Lo publicaremos automáticamente y lo tienes en tu calendario 🚀`
          : `En cola: se publicará en ${label} en los próximos minutos.`
      );
      setFile(null);
      setCaption("");
      setScheduledAt("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Sin conexión ──
  if (!connection) {
    return (
      <div
        className="bg-white rounded-2xl border p-10 text-center"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <PlatformIcon size={24} style={{ color: "var(--color-primary)" }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-serif)" }}>
          Conecta tu cuenta de {label}
        </h2>
        <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--color-muted-foreground)" }}>
          {isInstagram
            ? "Necesitas una cuenta business o creator vinculada a una página de Facebook. Publica Reels directamente desde aquí."
            : "Publica tus vídeos en TikTok directamente desde Social Flamingo, a la hora que mejor funciona."}
        </p>
        <a
          href={`/api/auth/${platform}/connect`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <PlatformIcon size={15} /> Conectar {label}
        </a>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
      {/* Cuenta conectada */}
      <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-[var(--color-border)]">
        {connection.account_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connection.account_avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <PlatformIcon size={16} style={{ color: "var(--color-primary)" }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">@{connection.account_name?.replace(/^@/, "")}</p>
          <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>{label} conectado</p>
        </div>
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--color-muted)]"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          {disconnecting ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />} Desconectar
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className="w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
          style={{
            borderColor: dragOver ? "var(--color-primary)" : "var(--color-border)",
            backgroundColor: dragOver ? "var(--color-primary-light)" : "transparent",
          }}
        >
          <Upload size={22} className="mx-auto mb-3" style={{ color: "var(--color-muted-foreground)" }} />
          <p className="text-sm font-medium">Arrastra tu vídeo aquí o haz clic para elegirlo</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
            {isInstagram ? "Se publica como Reel (9:16, MP4/MOV)" : "Vídeo vertical 9:16"} · máx. 200 MB
          </p>
        </button>
      ) : (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}
        >
          <Film size={18} className="flex-shrink-0" style={{ color: "var(--color-primary)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{formatBytes(file.size)}</p>
          </div>
          {!submitting && (
            <button
              onClick={() => setFile(null)}
              className="p-1.5 rounded-lg hover:bg-white transition-colors flex-shrink-0"
              aria-label="Quitar vídeo"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <div className="space-y-4 mt-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium">{isInstagram ? "Caption" : "Texto del post"}</label>
            <div className="flex items-center gap-3">
              <div ref={snippetsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setShowSnippets((v) => !v); onLoadSnippets(); }}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-70"
                  style={{ color: "var(--color-primary)" }}
                >
                  <PenLine size={10} /> Insertar firma <ChevronDown size={9} />
                </button>
                {showSnippets && (
                  <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[200px] z-20">
                    {snippets === null ? (
                      <p className="px-3 py-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Cargando...</p>
                    ) : snippets.length === 0 ? (
                      <a
                        href="/ajustes?tab=ia"
                        className="block px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors"
                        style={{ color: "var(--color-muted-foreground)" }}
                      >
                        Crea firmas en Ajustes → IA
                      </a>
                    ) : (
                      snippets.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => insertSnippet(s.content)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors truncate"
                          title={s.content}
                        >
                          {s.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: caption.length > 2200 ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
              >
                {caption.length.toLocaleString("es-ES")}/2.200
              </span>
            </div>
          </div>
          <textarea
            ref={captionRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
            rows={4}
            placeholder={isInstagram ? "Caption del Reel, hashtags..." : "Descripción del vídeo, hashtags..."}
            className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
          />
        </div>

        {!isInstagram && (
          <div>
            <label className="text-xs font-medium block mb-1.5">Visibilidad</label>
            <select
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value)}
              className="w-full sm:w-64 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors"
            >
              {tiktokPrivacyOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {TIKTOK_PRIVACY_LABELS[opt] ?? opt}
                </option>
              ))}
            </select>
            {!tiktokPrivacyOptions.includes("PUBLIC_TO_EVERYONE") && (
              <p className="text-[11px] mt-1.5" style={{ color: "var(--color-warning)" }}>
                Tu cuenta solo permite publicar en &quot;Solo yo&quot; hasta que TikTok apruebe la app.
              </p>
            )}
          </div>
        )}

        {/* Cuándo publicar */}
        <div>
          <label className="text-xs font-medium block mb-1.5">Publicación</label>
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-medium w-fit mb-3">
            <button
              type="button"
              onClick={() => setMode("schedule")}
              className="px-3.5 py-1.5 transition-colors"
              style={{
                backgroundColor: mode === "schedule" ? "var(--color-primary)" : "transparent",
                color: mode === "schedule" ? "white" : "var(--color-muted-foreground)",
              }}
            >
              Programar
            </button>
            <button
              type="button"
              onClick={() => setMode("now")}
              className="px-3.5 py-1.5 transition-colors"
              style={{
                backgroundColor: mode === "now" ? "var(--color-primary)" : "transparent",
                color: mode === "now" ? "white" : "var(--color-muted-foreground)",
                borderLeft: "1px solid var(--color-border)",
              }}
            >
              Publicar ahora
            </button>
          </div>

          {mode === "schedule" ? (
            <div className="space-y-2.5">
              <input
                type="datetime-local"
                value={scheduledAt}
                min={toLocalInputValue(new Date(Date.now() + 15 * 60_000))}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full sm:w-64 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              {bestSlots && bestSlots.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                    <Sparkles size={10} /> Mejores horas:
                  </span>
                  {bestSlots.map((s, i) => {
                    const d = nextOccurrence(s.weekday, s.hour);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setScheduledAt(toLocalInputValue(d))}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors hover:border-[var(--color-primary)]"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                      >
                        {WEEKDAY_SHORT[s.weekday]} {String(s.hour).padStart(2, "0")}:00
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                El vídeo queda en cola y lo publicamos automáticamente a esa hora.
              </p>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
              Se publicará en los próximos minutos.
            </p>
          )}
        </div>

        {formError && (
          <div className="text-xs rounded-xl px-3 py-2 border" style={{ color: "var(--color-destructive)", backgroundColor: "var(--destructive-muted)", borderColor: "var(--destructive-muted-border)" }}>
            {formError}
          </div>
        )}

        {successNote && (
          <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 border" style={{ color: "var(--color-success)", backgroundColor: "var(--bg-success)", borderColor: "transparent" }}>
            <Check size={13} className="flex-shrink-0" /> {successNote}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {submitting ? (
            <><Loader2 size={15} className="animate-spin" /> Subiendo vídeo...</>
          ) : mode === "schedule" ? (
            <><CalendarDays size={15} /> Programar publicación</>
          ) : (
            <><Upload size={15} /> Publicar ahora</>
          )}
        </button>
      </div>
    </section>
  );
}
