"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, MonitorPlay, Loader2, Check, AlertTriangle, X, Film,
  CalendarDays, PenLine, ChevronDown, Sparkles,
} from "lucide-react";
import type { Snippet } from "@/types";
import { formatBytes, formatDateTime, toLocalInputValue, nextOccurrence, WEEKDAY_SHORT } from "./shared";
import type { BestSlot } from "./shared";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export interface YoutubeConnectionSummary {
  channelName: string | null;
  channelThumbnail: string | null;
  canUpload: boolean;
}

interface Props {
  connection: YoutubeConnectionSummary | null;
  bestSlots: BestSlot[] | null;
  snippets: Snippet[] | null;
  onLoadSnippets: () => void;
  refreshPosts: () => void;
}

export function YoutubePanel({ connection, bestSlots, snippets, onLoadSnippets, refreshPosts }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("schedule");
  const [scheduledAt, setScheduledAt] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [showSnippets, setShowSnippets] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(connection ? !connection.canUpload : false);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const activePostIdRef = useRef<string | null>(null);
  const snippetsMenuRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!uploading) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [uploading]);

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
      title.trim().length > 0 &&
      title.trim().length <= 100 &&
      !uploading &&
      (mode === "now" || Boolean(scheduledAt)),
    [file, title, uploading, mode, scheduledAt]
  );

  function pickFile(f: File | undefined | null) {
    setFormError(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setFormError("El archivo debe ser un vídeo.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFormError("El vídeo supera el máximo de 2 GB.");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 100));
  }

  function insertSnippet(content: string) {
    setShowSnippets(false);
    setDescription((prev) => {
      const next = prev ? (prev.endsWith("\n") ? prev + content : `${prev}\n${content}`) : content;
      return next.slice(0, 5000);
    });
    descRef.current?.focus();
  }

  async function cleanupCancelledPost() {
    const id = activePostIdRef.current;
    if (!id) return;
    activePostIdRef.current = null;
    await fetch(`/api/publicaciones/${id}`, { method: "DELETE" }).catch(() => {});
    refreshPosts();
  }

  async function submit() {
    if (!file || !canSubmit) return;
    setFormError(null);
    setSuccessNote(null);
    setUploading(true);
    setProgress(0);

    try {
      const scheduledIso =
        mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null;

      const sessionRes = await fetch("/api/youtube/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          privacy,
          scheduledAt: scheduledIso,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        if (session.error === "RECONNECT_REQUIRED") {
          setNeedsReconnect(true);
          setFormError("Necesitas reconectar tu canal para conceder el permiso de subida.");
        } else if (session.error === "NOT_CONNECTED") {
          setFormError("Conecta tu canal de YouTube primero.");
        } else {
          setFormError(session.error ?? "No se pudo iniciar la subida.");
        }
        setUploading(false);
        return;
      }

      const { postId, uploadUrl } = session as { postId: string; uploadUrl: string };
      activePostIdRef.current = postId;
      refreshPosts();

      // Subida directa navegador → YouTube (los bytes no pasan por nuestros servidores)
      const videoId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/*");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              if (json.id) return resolve(json.id);
            } catch { /* cae al reject */ }
          }
          reject(new Error(`YouTube respondió ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Error de red durante la subida"));
        xhr.onabort = () => reject(new Error("ABORTED"));
        xhr.send(file);
      });

      const completeRes = await fetch("/api/youtube/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, videoId }),
      });
      const completed = await completeRes.json();
      if (!completeRes.ok) throw new Error(completed.error ?? "No se pudo confirmar la subida.");

      activePostIdRef.current = null;
      refreshPosts();
      setSuccessNote(
        scheduledIso
          ? `Programado: YouTube lo publicará automáticamente el ${formatDateTime(scheduledIso)}. Lo tienes en tu calendario 🚀`
          : "¡Vídeo publicado en YouTube!"
      );
      setFile(null);
      setTitle("");
      setDescription("");
      setScheduledAt("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      if (msg === "ABORTED") {
        await cleanupCancelledPost();
      } else {
        const id = activePostIdRef.current;
        activePostIdRef.current = null;
        if (id) {
          await fetch("/api/youtube/upload-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: id, error: msg }),
          }).catch(() => {});
          refreshPosts();
        }
        setFormError(`La subida ha fallado: ${msg}`);
      }
    } finally {
      xhrRef.current = null;
      setUploading(false);
      setProgress(0);
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
          <MonitorPlay size={24} style={{ color: "var(--color-primary)" }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-serif)" }}>
          Conecta tu canal de YouTube
        </h2>
        <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--color-muted-foreground)" }}>
          Sube Shorts y vídeos desde Social Flamingo y prográmalos para que se publiquen
          solos a la mejor hora.
        </p>
        <a
          href="/api/auth/youtube/connect?from=publicar"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <MonitorPlay size={15} /> Conectar canal
        </a>
        <p className="text-xs mt-5 max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Al conectar autorizas a Social Flamingo a subir vídeos a tu canal únicamente cuando tú
          lo pidas, y aceptas los{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-foreground)]">
            Términos de Servicio de YouTube
          </a>{" "}
          y la{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-foreground)]">
            Política de Privacidad de Google
          </a>. Más detalles en nuestra{" "}
          <a href="/privacidad" target="_blank" className="underline hover:text-[var(--color-foreground)]">
            Política de Privacidad
          </a>.
        </p>
      </div>
    );
  }

  return (
    <>
      {needsReconnect && (
        <div
          className="flex items-start gap-3 rounded-2xl border px-4 py-3.5 mb-6"
          style={{ borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }}
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }} />
          <div className="flex-1 text-sm" style={{ color: "#78350F" }}>
            <p className="font-semibold">Permiso de subida pendiente</p>
            <p className="text-xs mt-0.5" style={{ color: "#92400E" }}>
              Tu canal está conectado solo para estadísticas. Reconéctalo para autorizar la
              subida de vídeos (30 segundos).
            </p>
          </div>
          <a
            href="/api/auth/youtube/connect?from=publicar"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-85"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Reconectar
          </a>
        </div>
      )}

      <section
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: "var(--color-border)", opacity: needsReconnect ? 0.5 : 1, pointerEvents: needsReconnect ? "none" : "auto" }}
      >
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
              Vertical y de hasta 3 minutos se publica como Short · máx. 2 GB
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
            {!uploading && (
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
              <label className="text-xs font-medium">Título</label>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: title.length > 100 ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
              >
                {title.length}/100
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={110}
              placeholder="El título que verá tu audiencia en YouTube"
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium">Descripción</label>
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
            </div>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
              rows={4}
              placeholder="Descripción, hashtags, enlaces..."
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
            />
          </div>

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
                  El vídeo se sube ya en privado y YouTube lo hace público automáticamente a esa hora.
                </p>
              </div>
            ) : (
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                className="w-full sm:w-64 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors"
              >
                <option value="public">Público</option>
                <option value="unlisted">Oculto (con enlace)</option>
                <option value="private">Privado</option>
              </select>
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

          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 size={12} className="animate-spin" /> Subiendo a YouTube... no cierres esta pestaña
                </span>
                <span className="tabular-nums font-semibold">{progress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-muted)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: "var(--color-primary)" }}
                />
              </div>
              <button
                onClick={() => xhrRef.current?.abort()}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--color-destructive)" }}
              >
                Cancelar subida
              </button>
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {mode === "schedule" ? <><CalendarDays size={15} /> Programar publicación</> : <><Upload size={15} /> Publicar ahora</>}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
