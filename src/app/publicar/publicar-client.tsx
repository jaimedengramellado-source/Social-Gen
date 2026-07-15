"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Trash2, ExternalLink, Film, Loader2, Unplug, Zap } from "lucide-react";
import type { CrosspostRule, PublishPlatform, ScheduledPost, Snippet, SocialConnection, PostAutomation } from "@/types";
import { STATUS_META, PLATFORM_LABELS, formatDateTime, postPermalink } from "./shared";
import type { BestSlot } from "./shared";
import { Composer, PLATFORM_ICONS } from "./composer";
import type { PublishFlags, YoutubeConnectionSummary } from "./composer";
import { AutomationsSection } from "./automations-section";

const RULE_STATUS_META: Record<CrosspostRule["status"], { label: string; color: string; bg: string }> = {
  waiting: { label: "En espera", color: "var(--text-info)", bg: "var(--bg-info)" },
  fired: { label: "Disparada", color: "var(--color-success)", bg: "var(--bg-success)" },
  expired: { label: "Caducada", color: "var(--color-muted-foreground)", bg: "var(--color-muted)" },
  failed: { label: "Error", color: "var(--color-destructive)", bg: "var(--destructive-muted)" },
};

interface Props {
  flags: PublishFlags;
  youtubeConnection: YoutubeConnectionSummary | null;
  socialConnections: SocialConnection[];
  initialPosts: ScheduledPost[];
  initialRules: CrosspostRule[];
  initialAutomations: PostAutomation[];
}

export function PublicarClient({
  flags, youtubeConnection, socialConnections, initialPosts, initialRules, initialAutomations,
}: Props) {
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts);
  const [rules, setRules] = useState<CrosspostRule[]>(initialRules);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [bestSlots, setBestSlots] = useState<BestSlot[] | null>(null);
  const [connections, setConnections] = useState<SocialConnection[]>(socialConnections);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const refreshPosts = useCallback(() => {
    fetch("/api/publicaciones")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPosts(data); })
      .catch(() => {});
  }, []);

  const refreshRules = useCallback(() => {
    fetch("/api/publicaciones/rules")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRules(data); })
      .catch(() => {});
  }, []);

  const loadSnippets = useCallback(() => {
    setSnippets((prev) => {
      if (prev !== null) return prev;
      fetch("/api/snippets")
        .then((r) => r.json())
        .then((data) => setSnippets(Array.isArray(data) ? data : []))
        .catch(() => setSnippets([]));
      return prev;
    });
  }, []);

  useEffect(() => {
    fetch("/api/calendario/best-times")
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json?.slots)) setBestSlots(json.slots.slice(0, 3)); })
      .catch(() => {});
  }, []);

  // Con publicaciones en curso (cola del cron o procesando en la red), refrescar periódicamente
  useEffect(() => {
    const hasActive = posts.some((p) => p.status === "publishing" || (p.status === "scheduled" && !p.scheduled_at));
    if (!hasActive) return;
    const t = setInterval(refreshPosts, 30_000);
    return () => clearInterval(t);
  }, [posts, refreshPosts]);

  async function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/publicaciones/${id}`, { method: "DELETE" }).catch(() => {});
    refreshRules();
  }

  // Una regla multi origen/destino son varias filas con rule_group_id común:
  // en la UI se muestran y se borran como una sola
  const ruleGroups = useMemo(() => {
    const map = new Map<string, CrosspostRule[]>();
    for (const r of rules) {
      const list = map.get(r.rule_group_id) ?? [];
      list.push(r);
      map.set(r.rule_group_id, list);
    }
    return [...map.values()];
  }, [rules]);

  async function deleteRuleGroup(group: CrosspostRule[]) {
    const groupId = group[0].rule_group_id;
    setRules((prev) => prev.filter((r) => r.rule_group_id !== groupId));
    await fetch(`/api/publicaciones/rules/${group[0].id}?group=1`, { method: "DELETE" }).catch(() => {});
  }

  async function disconnect(platform: string) {
    setDisconnecting(platform);
    try {
      await fetch("/api/auth/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      setConnections((prev) => prev.filter((c) => c.platform !== platform));
    } finally {
      setDisconnecting(null);
    }
  }

  const showYoutubeDisclosure =
    flags.youtube && (!youtubeConnection || !youtubeConnection.canUpload);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1.5">Publicar</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-muted-foreground)" }}>
        Un mismo vídeo, todas tus redes: elige dónde publicarlo, adapta el texto a cada
        una y prográmalo para la mejor hora.
      </p>

      <Composer
        flags={flags}
        youtubeConnection={youtubeConnection}
        connections={connections}
        bestSlots={bestSlots}
        snippets={snippets}
        onLoadSnippets={loadSnippets}
        refreshPosts={refreshPosts}
        refreshRules={refreshRules}
      />

      {showYoutubeDisclosure && (
        <p className="text-xs mt-4 leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          Al conectar YouTube autorizas a Social Flamingo a subir vídeos a tu canal únicamente
          cuando tú lo pidas, y aceptas los{" "}
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
      )}

      {/* Lista de publicaciones */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted-foreground)" }}>
          Tus publicaciones
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "var(--color-muted-foreground)" }}>
            Aún no has publicado nada desde Social Flamingo.
          </p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => {
              const meta = STATUS_META[p.status];
              const PlatformIcon = PLATFORM_ICONS[(p.platform as PublishPlatform)] ?? Film;
              const permalink = postPermalink(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3.5 bg-white rounded-2xl border px-4 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {p.platform === "youtube" && p.youtube_video_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://i.ytimg.com/vi/${p.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-20 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-20 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "var(--color-muted)" }}
                    >
                      <PlatformIcon size={16} style={{ color: "var(--color-muted-foreground)" }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
                        <PlatformIcon size={10} /> {PLATFORM_LABELS[p.platform] ?? p.platform}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                      {p.scheduled_at && p.status === "scheduled" && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                          <Clock size={10} /> {formatDateTime(p.scheduled_at)}
                        </span>
                      )}
                      {p.status === "failed" && p.error && (
                        <span className="text-[11px] truncate max-w-[240px]" style={{ color: "var(--color-destructive)" }}>
                          {p.error}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {permalink && (
                      <a
                        href={permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
                        title={`Ver en ${PLATFORM_LABELS[p.platform] ?? p.platform}`}
                      >
                        <ExternalLink size={14} style={{ color: "var(--color-muted-foreground)" }} />
                      </a>
                    )}
                    {p.status !== "uploading" && p.status !== "publishing" && (
                      <button
                        onClick={() => deletePost(p.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--destructive-muted)]"
                        title={p.status === "published" ? "Quitar de la lista (el vídeo sigue publicado)" : "Eliminar"}
                      >
                        <Trash2 size={14} style={{ color: "var(--color-destructive)" }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reglas condicionales */}
      {ruleGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted-foreground)" }}>
            Reglas condicionales
          </h2>
          <div className="space-y-2">
            {ruleGroups.map((group) => {
              const first = group[0];
              const sources = [...new Set(group.map((r) => r.source_platform))];
              const targets = [...new Set(group.map((r) => r.target_platform))];
              const status: CrosspostRule["status"] = group.some((r) => r.status === "fired")
                ? "fired"
                : group.some((r) => r.status === "waiting")
                  ? "waiting"
                  : group.some((r) => r.status === "failed")
                    ? "failed"
                    : "expired";
              const meta = RULE_STATUS_META[status];
              const bestViews = Math.max(...group.map((r) => Number(r.last_views ?? -1)));
              const failedError = group.find((r) => r.status === "failed" && r.error)?.error;
              return (
                <div
                  key={first.rule_group_id}
                  className="flex items-center gap-3 bg-white rounded-2xl border px-4 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <Zap size={15} className="flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      Si <span className="font-medium">«{first.text.slice(0, 40)}{first.text.length > 40 ? "…" : ""}»</span>{" "}
                      supera las {first.threshold.toLocaleString("es-ES")} visitas en{" "}
                      {sources.map((s) => PLATFORM_LABELS[s]).join(" o ")} → publicar en{" "}
                      <span className="font-medium">{targets.map((t) => PLATFORM_LABELS[t]).join(" y ")}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                      {status === "waiting" && bestViews >= 0 && (
                        <span className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                          lleva {bestViews.toLocaleString("es-ES")} visitas
                        </span>
                      )}
                      {status === "failed" && failedError && (
                        <span className="text-[11px] truncate max-w-[240px]" style={{ color: "var(--color-destructive)" }}>
                          {failedError}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteRuleGroup(group)}
                    className="p-2 rounded-lg transition-colors hover:bg-[var(--destructive-muted)] flex-shrink-0"
                    title={status === "waiting" ? "Cancelar regla" : "Quitar de la lista"}
                  >
                    <Trash2 size={14} style={{ color: "var(--color-destructive)" }} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cuentas conectadas */}
      {connections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted-foreground)" }}>
            Cuentas conectadas
          </h2>
          <div className="space-y-2">
            {connections.map((c) => {
              const Icon = PLATFORM_ICONS[c.platform] ?? Film;
              return (
                <div
                  key={c.platform}
                  className="flex items-center gap-2.5 bg-white rounded-2xl border px-4 py-2.5"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {c.account_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.account_avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <Icon size={16} style={{ color: "var(--color-primary)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {/* LinkedIn guarda el nombre de la persona, no un handle */}
                      {!c.account_name
                        ? PLATFORM_LABELS[c.platform]
                        : c.platform === "linkedin"
                          ? c.account_name
                          : `@${c.account_name.replace(/^@/, "")}`}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
                      {PLATFORM_LABELS[c.platform]}
                    </p>
                  </div>
                  <button
                    onClick={() => disconnect(c.platform)}
                    disabled={disconnecting === c.platform}
                    className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--color-muted)]"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {disconnecting === c.platform ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Unplug size={11} />
                    )}{" "}
                    Desconectar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AutomationsSection enabled={flags.automations} initialAutomations={initialAutomations} />
    </div>
  );
}
