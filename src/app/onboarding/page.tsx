"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeInternalPath } from "@/lib/plan-intent";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CelebrationBurst } from "@/components/shared/celebration-burst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlanSteps } from "@/components/shared/plan-steps";
import type { Platform } from "@/types";

const PLATFORMS: { id: Platform; label: string; icon: string; desc: string }[] = [
  { id: "youtube_long", label: "YouTube", icon: "▶", desc: "Vídeos de 8-20 minutos" },
  { id: "youtube_shorts", label: "YouTube Shorts", icon: "▶", desc: "Menos de 60 segundos" },
  { id: "tiktok", label: "TikTok", icon: "♪", desc: "15-90 segundos" },
  { id: "reels", label: "Instagram Reels", icon: "⬡", desc: "Menos de 90 segundos" },
];

const SUBSCRIBER_RANGES = ["Aún no he empezado", "0-1K", "1K-10K", "10K-100K", "100K-1M", "+1M"];

const NICHE_PRESETS = [
  "Marketing y negocios",
  "Finanzas personales",
  "Fitness y salud",
  "Desarrollo personal",
  "Tecnología e IA",
  "Educación",
  "Gaming",
  "Belleza y moda",
  "Humor y entretenimiento",
  "Cocina",
  "Viajes",
  "Arte y música",
];

const GOAL_OPTIONS = [
  "Monetizar con publicidad y patrocinios",
  "Conseguir clientes para mi negocio",
  "Vender mis productos o cursos",
  "Hacer crecer mi comunidad",
  "Construir mi marca personal",
];

const DIFFERENTIATOR_OPTIONS = [
  "Mi experiencia y resultados propios",
  "Mi forma de explicar las cosas",
  "Mi personalidad y humor",
  "Mi conocimiento técnico",
  "Mi historia personal",
];

const TONE_PRESETS = [
  "Motivacional y cercano",
  "Divertido e informal",
  "Educativo y directo",
  "Profesional y serio",
  "Provocador y sin filtros",
];

const TOTAL_STEPS = 6;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm border transition-all ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
          : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
      }`}
    >
      {children}
    </button>
  );
}

function OptionalTag() {
  return <span className="font-normal text-[var(--color-muted-foreground)]">(opcional)</span>;
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"));
  const isPlanFlow = searchParams.get("payment") === "success";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  const [form, setForm] = useState({
    channelName: "",
    platforms: [] as Platform[],
    subscribersRange: "",
    niche: "",
    nicheDescription: "",
    goals: [] as string[],
    goalDetail: "",
    audiencePain: "",
    differentiators: [] as string[],
    differentiatorDetail: "",
    tone: "",
    aiInstructions: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleIn(field: "platforms" | "goals" | "differentiators", value: string) {
    setForm((prev) => {
      const list = prev[field] as string[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [field]: next };
    });
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const mainPlatform = form.platforms[0];
      const mainGoal = [form.goals.join(", "), form.goalDetail.trim()].filter(Boolean).join(". ");
      const differentiator = [form.differentiators.join(", "), form.differentiatorDetail.trim()]
        .filter(Boolean)
        .join(". ");

      await supabase.from("channels").insert({
        user_id: user.id,
        platform: mainPlatform,
        channel_name: form.channelName,
        subscribers_range: form.subscribersRange,
        niche: form.niche,
        niche_description: form.nicheDescription,
        main_goal: mainGoal || null,
        audience_pain: form.audiencePain.trim() || null,
        differentiator: differentiator || null,
        content_format: mainPlatform === "youtube_long" ? "long" : "short",
      });

      const { error } = await supabase.from("profiles").update({
        onboarding_completed: true,
        channel_name: form.channelName || null,
        main_platform: mainPlatform || null,
        platforms: form.platforms.length > 0 ? form.platforms : null,
        niche: form.niche || null,
        tone: form.tone.trim() || null,
        ai_instructions: form.aiInstructions.trim() || null,
      }).eq("id", user.id);
      if (error) throw error;

      router.push(nextPath);
    } catch {
      setLoading(false);
      alert("No se pudo guardar tu configuración. Inténtalo de nuevo.");
    }
  }

  const canAdvance = [
    step === 1 && form.channelName.length > 1 && form.platforms.length > 0,
    step === 2 && !!form.subscribersRange && form.niche.trim().length > 1,
    true,
    true,
    true,
    true,
  ][step - 1];

  const optionalUntouched =
    (step === 3 && form.goals.length === 0 && !form.goalDetail.trim()) ||
    (step === 4 && form.differentiators.length === 0 && !form.differentiatorDetail.trim() && !form.audiencePain.trim()) ||
    (step === 5 && !form.tone.trim() && !form.aiInstructions.trim());

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: "var(--color-background)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="text-center">
              <CelebrationBurst
                className="mb-6"
                icon={<PartyPopper className="h-9 w-9" style={{ color: "var(--color-primary)" }} />}
              />
              <motion.h1
                className="text-3xl mb-2"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
              >
                Te damos la bienvenida a{" "}
                <span style={{ color: "var(--color-primary)", fontStyle: "italic" }}>Social Flamingo</span>
              </motion.h1>
              <motion.p
                className="text-sm text-[var(--color-muted-foreground)]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35, ease: "easeOut" }}
              >
                Tu cuenta está lista. Vamos a configurar tu IA en un par de minutos.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-xl">
        {/* Logo */}
        <p className="text-center text-xl font-normal mb-10" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          Social Flamingo
        </p>

        {isPlanFlow && <PlanSteps current={3} />}

        {isPlanFlow && step === 1 && (
          <div className="mb-6 rounded-lg border border-[var(--color-success)] bg-[var(--bg-success)] px-3 py-2.5 text-sm text-[var(--text-success)] text-center">
            Pago completado — tu plan ya está activo. Último paso: configura tu IA.
          </div>
        )}

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${n <= step ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl border border-[var(--color-border)] p-8 shadow-[var(--shadow-card)]"
          >
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 1 de {TOTAL_STEPS}</p>
                  <h2 className="text-2xl font-semibold">Cuéntanos sobre tu canal</h2>
                  <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">La IA se adaptará a tu contenido y audiencia.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre de tu canal</Label>
                  <Input
                    placeholder="ej. Marketing con Juan"
                    value={form.channelName}
                    onChange={(e) => update("channelName", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">¿Dónde publicas?</Label>
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
                    Elige todas las que uses. La primera que marques será tu plataforma principal.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {PLATFORMS.map((p) => {
                      const selected = form.platforms.includes(p.id);
                      const isPrimary = form.platforms[0] === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleIn("platforms", p.id)}
                          className={`relative p-4 rounded-xl border text-left transition-all ${
                            selected
                              ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                              : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-white"
                          }`}
                        >
                          {isPrimary && (
                            <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white">
                              Principal
                            </span>
                          )}
                          <span className="text-xl block mb-1">{p.icon}</span>
                          <span className="font-medium text-sm block">{p.label}</span>
                          <span className="text-xs text-[var(--color-muted-foreground)]">{p.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 2 de {TOTAL_STEPS}</p>
                  <h2 className="text-2xl font-semibold">Tu audiencia actual</h2>
                </div>
                <div>
                  <Label className="mb-3 block">Suscriptores/seguidores</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBSCRIBER_RANGES.map((r) => (
                      <Chip key={r} selected={form.subscribersRange === r} onClick={() => update("subscribersRange", r)}>
                        {r}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-3 block">¿Cuál es tu nicho?</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {NICHE_PRESETS.map((n) => (
                      <Chip key={n} selected={form.niche === n} onClick={() => update("niche", n)}>
                        {n}
                      </Chip>
                    ))}
                  </div>
                  <Input
                    placeholder="¿No lo ves? Escríbelo: ajedrez, crianza, coches clásicos..."
                    value={NICHE_PRESETS.includes(form.niche) ? "" : form.niche}
                    onChange={(e) => update("niche", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Describe tu canal en 1-2 frases <OptionalTag /></Label>
                  <Textarea
                    placeholder="Ayudo a emprendedores a escalar su negocio online con estrategias de marketing probadas..."
                    value={form.nicheDescription}
                    onChange={(e) => update("nicheDescription", e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 3 de {TOTAL_STEPS}</p>
                  <h2 className="text-2xl font-semibold">Tu objetivo</h2>
                  <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
                    Si aún no lo tienes claro, salta este paso — la IA irá aprendiendo de ti.
                  </p>
                </div>
                <div>
                  <Label className="mb-3 block">¿Qué quieres conseguir con tu canal? <OptionalTag /></Label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((g) => (
                      <Chip key={g} selected={form.goals.includes(g)} onClick={() => toggleIn("goals", g)}>
                        {g}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)] mt-2">Puedes elegir varios.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Quieres contarnos más? <OptionalTag /></Label>
                  <Textarea
                    placeholder="ej. Quiero conseguir clientes para mi agencia de diseño web..."
                    value={form.goalDetail}
                    onChange={(e) => update("goalDetail", e.target.value)}
                    className="h-20"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 4 de {TOTAL_STEPS}</p>
                  <h2 className="text-2xl font-semibold">Tu audiencia y diferenciación</h2>
                  <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
                    Todo esto es opcional — cuanto más sepamos, mejores serán las ideas.
                  </p>
                </div>
                <div>
                  <Label className="mb-3 block">¿Qué te hace diferente? <OptionalTag /></Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DIFFERENTIATOR_OPTIONS.map((d) => (
                      <Chip key={d} selected={form.differentiators.includes(d)} onClick={() => toggleIn("differentiators", d)}>
                        {d}
                      </Chip>
                    ))}
                  </div>
                  <Input
                    placeholder="¿Algo más? ej. He facturado 100K con mi método..."
                    value={form.differentiatorDetail}
                    onChange={(e) => update("differentiatorDetail", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>¿Cuál es el mayor problema de tu audiencia? <OptionalTag /></Label>
                  <Textarea
                    placeholder="ej. No saben cómo conseguir sus primeros clientes sin gastar en publicidad..."
                    value={form.audiencePain}
                    onChange={(e) => update("audiencePain", e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 5 de {TOTAL_STEPS}</p>
                  <h2 className="text-2xl font-semibold">Tono e instrucciones para la IA</h2>
                  <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
                    Se guardan en tu perfil y se aplican a todo lo que generes. Podrás cambiarlos en Ajustes.
                  </p>
                </div>
                <div>
                  <Label className="mb-3 block">¿Qué tono usa tu contenido? <OptionalTag /></Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {TONE_PRESETS.map((t) => (
                      <Chip key={t} selected={form.tone === t} onClick={() => update("tone", t)}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                  <Input
                    placeholder="O escríbelo con tus palabras: irónico y técnico, cercano pero exigente..."
                    value={TONE_PRESETS.includes(form.tone) ? "" : form.tone}
                    onChange={(e) => update("tone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instrucciones para la IA <OptionalTag /></Label>
                  <Textarea
                    placeholder="Palabras que evitar, muletillas propias, estructura preferida, a quién le hablas..."
                    value={form.aiInstructions}
                    onChange={(e) => update("aiInstructions", e.target.value)}
                    className="h-28"
                  />
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6 text-center py-4">
                <div className="text-5xl">🚀</div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">¡Todo listo, {form.channelName}!</h2>
                  <p className="text-[var(--color-muted-foreground)]">
                    {isPlanFlow ? (
                      <>Tu plan está activo y tu perfil configurado. La IA ya conoce tu nicho, tono y audiencia.</>
                    ) : (
                      <>Tu perfil está configurado. La IA ya conoce tu nicho y audiencia. Tienes <strong>5 créditos gratis</strong> para empezar.</>
                    )}
                  </p>
                </div>
                <div className="bg-[var(--color-primary-light)] rounded-xl p-4 text-left">
                  <p className="text-sm font-medium text-[var(--color-primary)] mb-1">Sugerencia para empezar:</p>
                  <p className="text-sm text-[var(--color-primary)]/80">
                    Ve al dashboard y usa el botón ⚡ Sorpréndeme para recibir 5 ideas virales basadas en tu perfil, sin formulario.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              ← Atrás
            </Button>
          ) : (
            <div />
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              {optionalUntouched ? "Saltar →" : "Siguiente →"}
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading} size="lg">
              {loading ? "Configurando..." : "Ir al dashboard →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
