"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { PRICING_PLANS, PLAN_CREDITS } from "@/types";
import type { Profile, Channel } from "@/types";
import { Check, CreditCard, User, Sparkles, Shield } from "lucide-react";

const PLAN_BADGE: Record<string, "secondary" | "outline" | "purple" | "warning"> = {
  free: "secondary",
  starter: "outline",
  pro: "purple",
  agency: "warning",
};

const PLAN_LABEL: Record<string, string> = {
  free: "Gratuito",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Instagram Reels" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube_long", label: "YouTube (vídeo largo)" },
];

type ChannelSnippet = Pick<Channel, "id" | "platform" | "niche" | "niche_description">;

export function AjustesClient({ profile, channel }: { profile: Profile; channel: ChannelSnippet | null }) {
  const [name, setName] = useState(profile.full_name || "");
  const [channelName, setChannelName] = useState(profile.channel_name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  const [mainPlatform, setMainPlatform] = useState(channel?.platform || profile.main_platform || "");
  const [niche, setNiche] = useState(channel?.niche || profile.niche || "");
  const [nicheDesc, setNicheDesc] = useState(channel?.niche_description || "");
  const [tone, setTone] = useState(profile.tone || "");
  const [aiInstructions, setAiInstructions] = useState(profile.ai_instructions || "");
  const [savingAI, setSavingAI] = useState(false);
  const [savedAI, setSavedAI] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [upgradeBilling, setUpgradeBilling] = useState<"weekly" | "annual">("weekly");

  const pct = profile.credits_total > 0 ? (profile.credits_remaining / profile.credits_total) * 100 : 0;

  async function handleSaveProfile() {
    setSavingProfile(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: name, channel_name: channelName || null }).eq("id", profile.id);
    setSavingProfile(false);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2000);
  }

  async function handleSaveAI() {
    setSavingAI(true);
    const supabase = createClient();
    const saves: PromiseLike<unknown>[] = [
      supabase.from("profiles").update({
        main_platform: mainPlatform || null,
        niche: niche || null,
        tone: tone || null,
        ai_instructions: aiInstructions || null,
      }).eq("id", profile.id),
    ];
    if (channel) {
      saves.push(
        supabase.from("channels").update({
          platform: (mainPlatform || channel.platform) as Channel["platform"],
          niche,
          niche_description: nicheDesc,
        }).eq("id", channel.id)
      );
    }
    await Promise.all(saves);
    setSavingAI(false);
    setSavedAI(true);
    setTimeout(() => setSavedAI(false), 2000);
  }

  async function handleChangePassword() {
    setPasswordFeedback(null);
    if (newPassword.length < 8) {
      setPasswordFeedback({ ok: false, msg: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ ok: false, msg: "Las contraseñas no coinciden." });
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordFeedback({ ok: false, msg: error.message });
    } else {
      setPasswordFeedback({ ok: true, msg: "Contraseña actualizada correctamente." });
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleManageBilling() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url, error } = await res.json();
    if (error === "NO_CUSTOMER") {
      alert("No tienes una suscripción activa.");
      return;
    }
    if (url) window.location.href = url;
  }

  async function handleUpgrade(planId: string) {
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, billing: upgradeBilling }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-8">Mi cuenta</h1>

      {/* Card 1 — Perfil */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5" style={{ color: "var(--color-muted-foreground)" }} />
          <h2 className="text-base font-semibold">Perfil</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email || ""} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre del canal / @</Label>
            <Input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Ej: @micanal, Mi Canal de Fitness..."
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile || savedProfile} size="sm">
            {savedProfile ? (
              <><Check className="w-4 h-4 mr-1" />Guardado</>
            ) : savingProfile ? "Guardando..." : "Guardar perfil"}
          </Button>
        </div>
      </section>

      {/* Card 2 — Instrucciones para la IA */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
          <h2 className="text-base font-semibold">Instrucciones para la IA</h2>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--color-muted-foreground)" }}>
          La IA usará estas instrucciones automáticamente en todas tus creaciones.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plataforma principal</Label>
            <select
              value={mainPlatform}
              onChange={(e) => setMainPlatform(e.target.value)}
              className="w-full h-10 rounded-lg border px-3 text-sm bg-white outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">Selecciona tu plataforma...</option>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Nicho</Label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ej: fitness y nutrición, cocina vegana, finanzas personales..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción del nicho</Label>
            <textarea
              value={nicheDesc}
              onChange={(e) => setNicheDesc(e.target.value)}
              rows={3}
              placeholder="Describe en más detalle tu contenido y audiencia objetivo..."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none bg-white"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tono y personalidad</Label>
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Ej: motivacional y cercano, divertido e informal..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Instrucciones adicionales</Label>
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              rows={6}
              placeholder="Palabras que evitar, estructura preferida, audiencia objetivo..."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none bg-white"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <Button onClick={handleSaveAI} disabled={savingAI || savedAI} size="sm">
            {savedAI ? (
              <><Check className="w-4 h-4 mr-1" />Guardado</>
            ) : savingAI ? "Guardando..." : "Guardar instrucciones"}
          </Button>
        </div>
      </section>

      {/* Card 3 — Seguridad */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5" style={{ color: "var(--color-muted-foreground)" }} />
          <h2 className="text-base font-semibold">Seguridad</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar contraseña</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>
          {passwordFeedback && (
            <p
              className="text-sm"
              style={{ color: passwordFeedback.ok ? "var(--color-success)" : "var(--color-destructive)" }}
            >
              {passwordFeedback.msg}
            </p>
          )}
          <Button onClick={handleChangePassword} disabled={savingPassword} size="sm">
            {savingPassword ? "Cambiando..." : "Cambiar contraseña"}
          </Button>
        </div>
      </section>

      {/* Card 4 — Plan y suscripción */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5" style={{ color: "var(--color-muted-foreground)" }} />
          <h2 className="text-base font-semibold">Plan y suscripción</h2>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg capitalize">{profile.plan}</span>
            <Badge variant={PLAN_BADGE[profile.plan] ?? "secondary"}>
              {PLAN_LABEL[profile.plan] ?? profile.plan}
            </Badge>
          </div>
          {profile.stripe_subscription_id && (
            <Button variant="outline" size="sm" onClick={handleManageBilling}>
              Gestionar suscripción
            </Button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-bold">
              {profile.credits_remaining === -1 ? "∞" : profile.credits_remaining}
            </span>
            {profile.credits_remaining !== -1 && (
              <span className="text-sm mb-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                / {profile.credits_total} créditos esta semana
              </span>
            )}
          </div>
          <Progress value={profile.credits_remaining === -1 ? 100 : pct} />
          <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
            {PLAN_CREDITS[profile.plan]} créditos/semana en tu plan actual
          </p>
        </div>

        {profile.plan === "free" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Actualizar a:</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setUpgradeBilling("weekly")}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    upgradeBilling === "weekly"
                      ? "text-white"
                      : "hover:text-[var(--color-foreground)]"
                  }`}
                  style={
                    upgradeBilling === "weekly"
                      ? { backgroundColor: "var(--color-foreground)" }
                      : { color: "var(--color-muted-foreground)" }
                  }
                >
                  Semanal
                </button>
                <button
                  onClick={() => setUpgradeBilling("annual")}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    upgradeBilling === "annual"
                      ? "text-white"
                      : "hover:text-[var(--color-foreground)]"
                  }`}
                  style={
                    upgradeBilling === "annual"
                      ? { backgroundColor: "var(--color-foreground)" }
                      : { color: "var(--color-muted-foreground)" }
                  }
                >
                  Anual{" "}
                  <span style={{ color: "var(--color-success)" }} className="font-semibold">
                    −17%
                  </span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRICING_PLANS.filter((p) => p.id !== "free").map((plan) => {
                const displayPrice =
                  upgradeBilling === "weekly"
                    ? `${plan.price_weekly.toFixed(2).replace(".", ",")}€`
                    : `${(plan.price_annual_total / 52).toFixed(2).replace(".", ",")}€`;
                return (
                  <div
                    key={plan.id}
                    className="rounded-xl border p-4"
                    style={
                      plan.highlighted
                        ? {
                            borderColor: "var(--color-primary)",
                            backgroundColor: "var(--color-primary-light)",
                          }
                        : { borderColor: "var(--color-border)" }
                    }
                  >
                    <p className="font-semibold text-sm mb-0.5">{plan.name}</p>
                    <p className="text-lg font-bold mb-0.5">
                      {displayPrice}
                      <span className="text-xs font-normal" style={{ color: "var(--color-muted-foreground)" }}>
                        /sem
                      </span>
                    </p>
                    {upgradeBilling === "annual" && (
                      <p className="text-xs mb-1" style={{ color: "var(--color-muted-foreground)" }}>
                        {plan.price_annual_total.toFixed(2).replace(".", ",")}€/año
                      </p>
                    )}
                    <p className="text-xs mb-3" style={{ color: "var(--color-muted-foreground)" }}>
                      {plan.credits} créditos/semana
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      Elegir
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
