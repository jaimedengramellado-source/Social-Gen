"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Platform } from "@/types";

const PLATFORMS: { id: Platform; label: string; icon: string; desc: string }[] = [
  { id: "youtube_long", label: "YouTube", icon: "▶", desc: "Vídeos de 8-20 minutos" },
  { id: "youtube_shorts", label: "YouTube Shorts", icon: "▶", desc: "Menos de 60 segundos" },
  { id: "tiktok", label: "TikTok", icon: "♪", desc: "15-90 segundos" },
  { id: "reels", label: "Instagram Reels", icon: "⬡", desc: "Menos de 90 segundos" },
];

const SUBSCRIBER_RANGES = ["0-1K", "1K-10K", "10K-100K", "100K-1M", "+1M"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    channelName: "",
    platform: "" as Platform | "",
    subscribersRange: "",
    niche: "",
    nicheDescription: "",
    mainGoal: "",
    audiencePain: "",
    differentiator: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFinish() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("channels").insert({
      user_id: user.id,
      platform: form.platform,
      channel_name: form.channelName,
      subscribers_range: form.subscribersRange,
      niche: form.niche,
      niche_description: form.nicheDescription,
      main_goal: form.mainGoal,
      audience_pain: form.audiencePain,
      differentiator: form.differentiator,
      content_format: form.platform?.includes("short") || form.platform === "tiktok" || form.platform === "reels" ? "short" : "long",
    });

    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    router.push("/dashboard");
  }

  const canAdvance = [
    step === 1 && form.channelName.length > 1 && !!form.platform,
    step === 2 && !!form.subscribersRange && form.niche.length > 1,
    step === 3 && form.mainGoal.length > 1,
    step === 4 && form.audiencePain.length > 1,
    true,
  ][step - 1];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="w-full max-w-xl">
        {/* Logo */}
        <p className="text-center text-xl font-normal mb-10" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          Social Gen
        </p>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {[1, 2, 3, 4, 5].map((n) => (
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
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 1 de 5</p>
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
                  <Label className="mb-3 block">Plataforma principal</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => update("platform", p.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          form.platform === p.id
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                            : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-white"
                        }`}
                      >
                        <span className="text-xl block mb-1">{p.icon}</span>
                        <span className="font-medium text-sm block">{p.label}</span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 2 de 5</p>
                  <h2 className="text-2xl font-semibold">Tu audiencia actual</h2>
                </div>
                <div>
                  <Label className="mb-3 block">Suscriptores/seguidores</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBSCRIBER_RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => update("subscribersRange", r)}
                        className={`px-4 py-2 rounded-full text-sm border transition-all ${
                          form.subscribersRange === r
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
                            : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Cuál es tu nicho?</Label>
                  <Input
                    placeholder="ej. marketing digital, finanzas personales, fitness..."
                    value={form.niche}
                    onChange={(e) => update("niche", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Describe tu canal en 1-2 frases</Label>
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
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 3 de 5</p>
                  <h2 className="text-2xl font-semibold">Tu objetivo principal</h2>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Qué quieres conseguir con tu canal?</Label>
                  <Textarea
                    placeholder="ej. Conseguir clientes para mi agencia, monetizar con patrocinios, construir una comunidad..."
                    value={form.mainGoal}
                    onChange={(e) => update("mainGoal", e.target.value)}
                    className="h-28"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Paso 4 de 5</p>
                  <h2 className="text-2xl font-semibold">Tu audiencia y diferenciación</h2>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Cuál es el mayor problema de tu audiencia?</Label>
                  <Textarea
                    placeholder="ej. No saben cómo conseguir sus primeros clientes sin gastar en publicidad..."
                    value={form.audiencePain}
                    onChange={(e) => update("audiencePain", e.target.value)}
                    className="h-24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>¿Por qué deberían elegirte a ti?</Label>
                  <Textarea
                    placeholder="ej. Comparto estrategias que he aplicado yo mismo y que han generado resultados reales..."
                    value={form.differentiator}
                    onChange={(e) => update("differentiator", e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 text-center py-4">
                <div className="text-5xl">🚀</div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">¡Todo listo, {form.channelName}!</h2>
                  <p className="text-[var(--color-muted-foreground)]">
                    Tu perfil está configurado. La IA ya conoce tu nicho y audiencia.
                    Tienes <strong>10 créditos gratis</strong> para empezar.
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
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Siguiente →
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
