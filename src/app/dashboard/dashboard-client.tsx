"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, ArrowRight, TrendingUp, FileText, Plus, Bookmark, Lightbulb, Check } from "lucide-react";
import Link from "next/link";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { SavedIdeasModal } from "@/components/creator/saved-ideas-modal";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { timeAgo, buildScriptSeedPrompt, CREAR_SEED_STORAGE_KEY } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/types";
import type { Profile, Idea } from "@/types";

// Las ideas pueden llegar sin id si el insert en BD falló — el flujo de clic no lo necesita.
type SurpriseIdea = Pick<Idea, "title" | "description" | "viral_score"> & { id?: string };

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

const SORPRESA_LOADING_PHRASES = [
  "Analizando tu nicho…",
  "Descartando lo predecible…",
  "Buscando ángulos que nadie ha tocado…",
  "Puntuando el potencial viral…",
  "Puliendo los títulos…",
];

// La generación tarda 20-45s: los esqueletos ocupan el hueco donde aparecerán las
// ideas y las frases rotando transmiten avance real, no un spinner congelado.
function SorpresaLoadingCards({ slow }: { slow: boolean }) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhraseIdx(i => (i + 1) % SORPRESA_LOADING_PHRASES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12 }}
          className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[var(--color-border)]"
        >
          <div className="flex-1 min-w-0 space-y-2 animate-pulse">
            <div className="h-3.5 rounded-full bg-[var(--color-muted)]" style={{ width: `${72 - i * 14}%` }} />
            <div className="h-3 rounded-full bg-[var(--color-muted)]" style={{ width: `${88 - i * 10}%` }} />
          </div>
          <div className="w-9 h-9 rounded-full flex-shrink-0 animate-pulse bg-[var(--color-muted)]" />
        </motion.div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <span className="relative flex w-2 h-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-60" style={{ backgroundColor: YT_RED }} />
          <span className="relative inline-flex w-2 h-2 rounded-full" style={{ backgroundColor: YT_RED }} />
        </span>
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="text-xs text-[var(--color-muted-foreground)]"
          >
            {SORPRESA_LOADING_PHRASES[phraseIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
      {slow && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] text-[var(--color-muted-foreground)]"
        >
          La IA está afinando las ideas, puede tardar hasta un minuto…
        </motion.p>
      )}
    </motion.div>
  );
}

export function DashboardClient({ profile, recentIdeas, recentScripts, totalScripts, totalIdeas }: DashboardClientProps) {
  const router = useRouter();
  const [sorprendiendome, setSorprendiendome] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showSavedIdeas, setShowSavedIdeas] = useState(false);
  const [savedIdeasCount, setSavedIdeasCount] = useState(totalIdeas);
  const [sorpresas, setSorpresas] = useState<SurpriseIdea[]>([]);
  const [sorprendeError, setSorprendeError] = useState<string | null>(null);
  const [sorprendeSlow, setSorprendeSlow] = useState(false);
  const [feedbackCopied, setFeedbackCopied] = useState(false);

  async function copyFeedbackEmail() {
    try {
      await navigator.clipboard.writeText("service@socialflamingo.app");
      setFeedbackCopied(true);
      setTimeout(() => setFeedbackCopied(false), 2000);
    } catch {
      // portapapeles no disponible (contexto no seguro); el enlace del texto sigue funcionando
    }
  }

  function openIdeaInChat(idea: SurpriseIdea) {
    // Siembra el chat vía sessionStorage en vez de /crear?idea=<id>: no depende de que
    // el insert en BD funcionara ni de un fetch extra al montar /crear, así el clic
    // nunca acaba en un chat vacío.
    try {
      sessionStorage.setItem(CREAR_SEED_STORAGE_KEY, buildScriptSeedPrompt(idea.title, idea.description));
      router.push("/crear");
    } catch {
      router.push(idea.id ? `/crear?idea=${idea.id}` : "/crear");
    }
  }

  const firstName = profile.full_name?.split(" ")[0] || "creador";
  const avgScore = (() => {
    if (!recentScripts.length) return null;
    const sum = recentScripts.reduce((s, r) => s + (r.viral_score || 0), 0);
    if (sum === 0) return null;
    return Math.round(sum / recentScripts.length);
  })();

  async function handleSorprendeme() {
    setSorprendiendome(true);
    setSorprendeError(null);
    setSorprendeSlow(false);
    // Sin esto, una respuesta lenta (la IA con thinking puede tardar 30-45s) se ve
    // idéntica a un cuelgue real — no hay forma de distinguirlos sin límite de tiempo ni feedback.
    const slowTimer = setTimeout(() => setSorprendeSlow(true), 10000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 75000);
    try {
      const res = await fetch("/api/ai/sorprendeme", { method: "POST", signal: controller.signal });
      const data = await res.json();
      if (res.status === 402) { setShowUpgrade(true); return; }
      if (res.status === 429) { setSorprendeError("Estás generando ideas muy rápido. Espera un momento y vuelve a intentarlo."); return; }
      if (!res.ok || !data.ideas) { setSorprendeError("No se han podido generar ideas. Vuelve a intentarlo."); return; }
      setSorpresas(data.ideas);
    } catch (err) {
      setSorprendeError(
        err instanceof DOMException && err.name === "AbortError"
          ? "La generación está tardando demasiado. Vuelve a intentarlo en unos minutos."
          : "Fallo de conexión. Comprueba tu internet y vuelve a intentarlo."
      );
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setSorprendiendome(false);
      setSorprendeSlow(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} plan={profile.plan} />
      <SavedIdeasModal
        open={showSavedIdeas}
        onClose={() => setShowSavedIdeas(false)}
        onDeleted={() => setSavedIdeasCount((c) => Math.max(0, c - 1))}
      />

      {/* ── Feedback banner ── */}
      <div
        className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start gap-3">
          <Lightbulb size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold mb-0.5">¿Tienes una propuesta de mejora?</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Si echas en falta alguna función o algo no funciona como esperas, cuéntanoslo y lo
              implementamos sin problema. Escríbenos a{" "}
              <a href="mailto:service@socialflamingo.app" className="font-medium underline text-[var(--color-foreground)]">
                service@socialflamingo.app
              </a>
              .
            </p>
          </div>
        </div>
        <button
          onClick={copyFeedbackEmail}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-80"
          style={{ backgroundColor: YT_RED }}
        >
          {feedbackCopied ? (
            <>
              <Check size={14} /> Correo copiado
            </>
          ) : (
            "Enviar feedback"
          )}
        </button>
      </div>

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-0.5" style={{ fontFamily: "var(--font-serif)" }} suppressHydrationWarning>{greeting()}, {firstName}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]" suppressHydrationWarning>
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
        style={{ borderColor: YT_RED, boxShadow: "0 4px 24px rgba(140,34,48,0.10)" }}
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
        <div
          className="bg-white rounded-2xl border border-[var(--color-border)] p-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <FileText size={14} className="text-[var(--color-muted-foreground)] mb-2" />
          <p className="text-2xl font-black" style={{ color: YT_RED }}>{totalScripts}</p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">Guiones creados</p>
        </div>
        <button
          onClick={() => setShowSavedIdeas(true)}
          className="text-left bg-white rounded-2xl border-2 p-4 transition-all hover:-translate-y-0.5"
          style={{ borderColor: YT_RED, boxShadow: "var(--shadow-card)" }}
        >
          <Bookmark size={14} style={{ color: YT_RED }} className="mb-2" />
          <p className="text-2xl font-black" style={{ color: YT_RED }}>{savedIdeasCount}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: YT_RED }}>Ideas guardadas →</p>
        </button>
        <div
          className="bg-white rounded-2xl border border-[var(--color-border)] p-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <TrendingUp size={14} className="text-[var(--color-muted-foreground)] mb-2" />
          <p className="text-2xl font-black" style={{ color: YT_RED }}>{avgScore !== null ? avgScore : "—"}</p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">Viral score medio</p>
        </div>
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

        {sorprendiendome && <SorpresaLoadingCards slow={sorprendeSlow} />}

        {sorprendeError && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-xs font-medium"
            style={{ color: "var(--color-destructive)" }}
          >
            {sorprendeError}
          </motion.p>
        )}

        {!sorprendiendome && sorpresas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-2">
            {sorpresas.map((idea, i) => (
              <button
                key={idea.id ?? `sorpresa-${i}`}
                type="button"
                onClick={() => openIdeaInChat(idea)}
                className="group w-full text-left flex items-center justify-between gap-4 p-3 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-foreground)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{idea.title}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)] truncate">{idea.description}</p>
                </div>
                <ViralScoreBadge score={idea.viral_score} size="sm" />
                <ArrowRight
                  size={14}
                  className="flex-shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
            <p className="text-[11px] text-[var(--color-muted-foreground)] pt-1">
              Toca una idea y la IA escribirá su guion completo en el chat.
            </p>
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
