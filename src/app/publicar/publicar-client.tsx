"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock, Trash2, ExternalLink, Film, MonitorPlay, AtSign, Music2,
} from "lucide-react";
import type { ScheduledPost, Snippet, SocialConnection, PostAutomation } from "@/types";
import { STATUS_META, PLATFORM_LABELS, formatDateTime, postPermalink } from "./shared";
import type { BestSlot } from "./shared";
import { YoutubePanel } from "./youtube-panel";
import type { YoutubeConnectionSummary } from "./youtube-panel";
import { SocialPanel } from "./social-panel";
import { AutomationsSection } from "./automations-section";

type PlatformTab = "youtube" | "instagram" | "tiktok";

const PLATFORM_ICONS: Record<PlatformTab, React.ElementType> = {
  youtube: MonitorPlay,
  instagram: AtSign,
  tiktok: Music2,
};

export interface PublishFlags {
  youtube: boolean;
  instagram: boolean;
  tiktok: boolean;
  automations: boolean;
}

interface Props {
  flags: PublishFlags;
  youtubeConnection: YoutubeConnectionSummary | null;
  socialConnections: SocialConnection[];
  initialPosts: ScheduledPost[];
  initialAutomations: PostAutomation[];
}

export function PublicarClient({
  flags, youtubeConnection, socialConnections, initialPosts, initialAutomations,
}: Props) {
  const firstEnabled: PlatformTab = flags.youtube ? "youtube" : flags.instagram ? "instagram" : "tiktok";
  const [tab, setTab] = useState<PlatformTab>(firstEnabled);
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [bestSlots, setBestSlots] = useState<BestSlot[] | null>(null);
  const [connections, setConnections] = useState<SocialConnection[]>(socialConnections);

  const refreshPosts = useCallback(() => {
    fetch("/api/publicaciones")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPosts(data); })
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
  }

  const igConnection = connections.find((c) => c.platform === "instagram") ?? null;
  const ttConnection = connections.find((c) => c.platform === "tiktok") ?? null;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Publicar</h1>

      {/* Selector de plataforma */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {(["youtube", "instagram", "tiktok"] as PlatformTab[]).map((p) => {
          const Icon = PLATFORM_ICONS[p];
          const enabled = flags[p];
          const active = tab === p;
          return (
            <button
              key={p}
              onClick={() => setTab(p)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors flex-shrink-0"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: active ? "var(--color-primary-light)" : "var(--color-card)",
                color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
              }}
            >
              <Icon size={14} />
              {PLATFORM_LABELS[p]}
              {!enabled && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
                >
                  Pronto
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel de la plataforma activa */}
      {!flags[tab] ? (
        <div
          className="bg-white rounded-2xl border border-dashed p-10 text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          {(() => { const Icon = PLATFORM_ICONS[tab]; return (
            <Icon size={22} className="mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
          ); })()}
          <h2 className="text-lg font-semibold mb-1.5" style={{ fontFamily: "var(--font-serif)" }}>
            {PLATFORM_LABELS[tab]}, próximamente
          </h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--color-muted-foreground)" }}>
            Publicar en {PLATFORM_LABELS[tab]} desde Social Flamingo está en preparación.
            Mientras tanto puedes planificarlo en el calendario.
          </p>
        </div>
      ) : tab === "youtube" ? (
        <YoutubePanel
          connection={youtubeConnection}
          bestSlots={bestSlots}
          snippets={snippets}
          onLoadSnippets={loadSnippets}
          refreshPosts={refreshPosts}
        />
      ) : (
        <SocialPanel
          platform={tab}
          connection={tab === "instagram" ? igConnection : ttConnection}
          bestSlots={bestSlots}
          snippets={snippets}
          onLoadSnippets={loadSnippets}
          refreshPosts={refreshPosts}
          onDisconnected={() => setConnections((prev) => prev.filter((c) => c.platform !== tab))}
        />
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
              const PlatformIcon = PLATFORM_ICONS[(p.platform as PlatformTab)] ?? Film;
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

      <AutomationsSection enabled={flags.automations} initialAutomations={initialAutomations} />
    </div>
  );
}
