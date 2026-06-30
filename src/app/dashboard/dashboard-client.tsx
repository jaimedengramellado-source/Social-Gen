"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, ArrowRight, TrendingUp, FileText, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { timeAgo } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/types";
import type { Profile, Idea } from "@/types";

const YT_RED = "var(--color-primary)";

interface DashboardClientProps {
  profile: Profile;
  recentIdeas: Idea[];
  recentScripts: {
    id: string;
    title: string;
    platform: string;
    viral_score: number;
    created_at: string;
    status: string;
  }[];
  totalScripts: number;
  totalIdeas: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardClient({ profile, recentIdeas, recentScripts, totalScripts, totalIdeas }: DashboardClientProps) {
  const router = useRouter();
  const [sorprendiendome, setSorprendiendome] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [sorpresas, setSorpresas] = useState<Idea[]>([]);

  const firstName = profile.full_name?.split(" ")[0] || "creador";
  const avgScore = (() => {
    if (!recentScripts.length) return null;
    const sum = recentScripts.reduce((s, r) => s + (r.viral_score || 0), 0);
    if (sum === 0) return null;
    return Math.round(sum / recentScripts.length);
  })();

  async function handleSorprendeme() {
    setSorprendiendome(true);
    const res = await fetch("/api/ai/sorprendeme", { method: "POST" });
    const data = await res.json();
    if (res.status === 402) { setShowUpgrade(true); setSorprendiendome(false); return; }
    if (data.ideas) setSorpresas(data.ideas);
    setSorprendiendome(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} />

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-0.5" style={{ fontFamily: "var(--font-serif)" }}>{greeting()}, {firstName}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "rgba(255,0,0,0.07)", color: YT_RED }}
        >
          <Zap size={14} />
          {profile.credits_remaining === -1 ? "∞" : (profile.credits_remaining ?? 0)} créditos
        </div>
      </div>

      {/* ── Primary CTA ── */}
      <div
        className="mb-6 p-5 md:p-6 rounded-2xl border-2 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6"
        style={{ borderColor: YT_RED, boxShadow: "0 4px 24px rgba(124,58,237,0.10)" }}
      >
        <div>
          <p className="text-base font-semibold mb-1">Crea tu próximo guion viral</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Ideas con IA · guion completo · puntuación viral
          </p>
        </div>
        <Link
          href="/crear"
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-80"
          style={{ backgroundColor: YT_RED }}
        >
          <Plus size={15} /> Nuevo guion
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Guiones creados", value: totalScripts.toString(), icon: FileText },
          { label: "Ideas guardadas", value: totalIdeas.toString(), icon: Sparkles },
          { label: "Viral score medio", value: avgScore !== null ? `${avgScore}` : "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-[var(--color-border)] p-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <Icon size={14} className="text-[var(--color-muted-foreground)] mb-2" />
            <p className="text-2xl font-black" style={{ color: YT_RED }}>{value}</p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Sorpréndeme ── */}
      <div className="mb-8 p-5 rounded-2xl border border-dashed border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold mb-0.5">¿Sin ideas hoy?</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              La IA genera ideas personalizadas basadas en tu perfil · 2 créditos
            </p>
          </div>
          <button
            onClick={handleSorprendeme}
            disabled={sorprendiendome}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap disabled:opacity-60"
            style={{ borderColor: YT_RED, color: YT_RED }}
          >
            {sorprendiendome ? (
              <span className="inline-flex gap-1">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">·</span>
                <span className="animate-bounce [animation-delay:300ms]">·</span>
              </span>
            ) : <Zap size={13} />}
            {sorprendiendome ? "Generando…" : "Sorpréndeme"}
          </button>
        </div>

        {sorpresas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
            {sorpresas.map((idea) => (
              <div
                key={idea.id}
                onClick={() => router.push(`/crear?idea=${idea.id}`)}
                className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-foreground)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{idea.title}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)] truncate">{idea.description}</p>
                </div>
                <ViralScoreBadge score={idea.viral_score} size="sm" />
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Recent scripts ── */}
      {recentScripts.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Guiones recientes</h2>
            <Link
              href="/documentos"
              className="flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: YT_RED }}
            >
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentScripts.map((script) => (
              <Link key={script.id} href={`/crear?script=${script.id}`}>
                <div
                  className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{script.title}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                      {PLATFORM_LABELS[script.platform as keyof typeof PLATFORM_LABELS] || script.platform}
                      {" · "}{timeAgo(script.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ViralScoreBadge score={script.viral_score} size="sm" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)]">
          <p className="text-3xl mb-3">✨</p>
          <p className="font-semibold mb-1">Tu primer viral está a 3 clics</p>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-5">Genera ideas, elige la mejor y escribe tu guion.</p>
          <Link
            href="/crear"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: YT_RED }}
          >
            Crear mi primer guion →
          </Link>
        </div>
      )}
    </div>
  );
}
