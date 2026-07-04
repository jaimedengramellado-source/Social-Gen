"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { PRICING_PLANS, PLAN_CREDITS, CREDIT_COSTS } from "@/types";
import type { Profile, Channel } from "@/types";
import { getTopupCredits, getTopupTier, CREDIT_TIERS } from "@/lib/stripe";
import {
  Check,
  CreditCard,
  Sparkles,
  Shield,
  Camera,
  Loader2,
  Calendar,
  TrendingUp,
  Zap,
  Package,
  User,
} from "lucide-react";

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

const PLAN_ORDER: Record<string, number> = { free: 0, starter: 1, pro: 2, agency: 3 };

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Instagram Reels" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube_long", label: "YouTube (vídeo largo)" },
];

const ACTION_LABELS: Record<string, string> = {
  generate_5_ideas: "Ideas (×5)",
  generate_10_ideas: "Ideas (×10)",
  generate_15_ideas: "Ideas (×15)",
  generate_script: "Guiones",
  regenerate_section: "Regenerar sección",
  sorprendeme: "Sorpréndeme",
  analyze_channel: "Analizar canal",
  analyze_idea: "Analizar idea",
  score_script: "Puntuar guión",
  generate_image: "Generar imagen",
  edit_image: "Editar imagen",
  image_variation: "Variación de imagen",
};

const TOPUP_PRESETS = [5, 10, 25, 50, 100];

type ChannelSnippet = Pick<Channel, "id" | "platform" | "niche" | "niche_description">;
type UsageEntry = { action: string; total: number };

function formatMemberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

interface AjustesClientProps {
  profile: Profile;
  channel: ChannelSnippet | null;
  usageByAction: UsageEntry[];
  scriptsCount: number;
  ideasCount: number;
}

export function AjustesClient({ profile, channel, usageByAction, scriptsCount, ideasCount }: AjustesClientProps) {
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

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [topupInput, setTopupInput] = useState("10");
  const [topupRecurring, setTopupRecurring] = useState(false);
  const [buyingTopup, setBuyingTopup] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      setTopupSuccess(true);
      window.history.replaceState({}, "", "/ajustes");
    }
  }, []);

  const validAmount = Math.max(5, Math.min(500, parseInt(topupInput) || 5));
  const topupCredits = getTopupCredits(validAmount);
  const tier = getTopupTier(validAmount);
  const nextTier = CREDIT_TIERS.find(t => t.min > validAmount) ?? null;

  const pct = profile.credits_total > 0 ? (profile.credits_remaining / profile.credits_total) * 100 : 0;
  const upgradePlans = PRICING_PLANS.filter((p) => PLAN_ORDER[p.id] > PLAN_ORDER[profile.plan]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploadingAvatar(true);
    const supabase = createClient();
    const path = `${profile.id}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (!uploadError) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
      setAvatarUrl(publicUrl + "?t=" + Date.now());
    }
    setUploadingAvatar(false);
    // reset so the same file can be selected again
    e.target.value = "";
  }

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

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    const res = await fetch("/api/ajustes/delete-account", { method: "POST" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const { error } = await res.json();
      alert(error ?? "No se pudo eliminar la cuenta. Inténtalo de nuevo.");
      setDeletingAccount(false);
    }
  }

  async function handleBuyTopup() {
    if (validAmount < 5 || validAmount > 500) return;
    setBuyingTopup(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topup: { amount: validAmount, recurring: topupRecurring } }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setBuyingTopup(false);
    }
  }

  const initials = (profile.full_name?.[0] ?? profile.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Mi cuenta</h1>

      {/* Header persistente con avatar */}
      <div
        className="flex items-center gap-4 rounded-2xl border p-5 mb-6 bg-white"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="relative shrink-0">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl} alt={profile.full_name ?? ""} />
            <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Cambiar foto de perfil"
            className="absolute bottom-0 right-0 h-6 w-6 rounded-full flex items-center justify-center shadow-sm transition-opacity hover:opacity-90 focus:outline-none"
            style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
          >
            {uploadingAvatar
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Camera className="h-3 w-3" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{profile.full_name || "Sin nombre"}</p>
          <p className="text-sm truncate" style={{ color: "var(--color-muted-foreground)" }}>{profile.email}</p>
          <Badge variant={PLAN_BADGE[profile.plan] ?? "secondary"} className="mt-1.5">
            {PLAN_LABEL[profile.plan] ?? profile.plan}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="cuenta">
        <TabsList className="w-full mb-6 grid grid-cols-4 h-auto">
          <TabsTrigger value="cuenta">Cuenta</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        {/* Tab: Cuenta */}
        <TabsContent value="cuenta">
          {/* Stats de la cuenta */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--color-muted)" }}
            >
              <Calendar className="h-4 w-4 mx-auto mb-1" style={{ color: "var(--color-muted-foreground)" }} />
              <p className="text-xs mb-0.5" style={{ color: "var(--color-muted-foreground)" }}>Miembro desde</p>
              <p className="text-sm font-medium capitalize">{formatMemberSince(profile.created_at)}</p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--color-muted)" }}
            >
              <TrendingUp className="h-4 w-4 mx-auto mb-1" style={{ color: "var(--color-muted-foreground)" }} />
              <p className="text-xs mb-0.5" style={{ color: "var(--color-muted-foreground)" }}>Guiones</p>
              <p className="text-sm font-semibold">{scriptsCount}</p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: "var(--color-muted)" }}
            >
              <Zap className="h-4 w-4 mx-auto mb-1" style={{ color: "var(--color-muted-foreground)" }} />
              <p className="text-xs mb-0.5" style={{ color: "var(--color-muted-foreground)" }}>Ideas</p>
              <p className="text-sm font-semibold">{ideasCount}</p>
            </div>
          </div>

          {/* Formulario de perfil */}
          <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
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
        </TabsContent>

        {/* Tab: IA */}
        <TabsContent value="ia">
          <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
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
        </TabsContent>

        {/* Tab: Seguridad */}
        <TabsContent value="seguridad">
          <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
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

          {/* Zona de peligro */}
          <section
            className="rounded-2xl border p-6 mt-6"
            style={{ borderColor: "var(--color-destructive)", backgroundColor: "#FFF5F5" }}
          >
            <h2 className="text-base font-semibold mb-1" style={{ color: "var(--color-destructive)" }}>
              Zona de peligro
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--color-muted-foreground)" }}>
              Eliminar tu cuenta borrará permanentemente todos tus datos: guiones, ideas, imágenes, historial de chat y configuración. Esta acción no se puede deshacer.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDeleteConfirm(""); setShowDeleteDialog(true); }}
              style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}
            >
              Eliminar mi cuenta
            </Button>
          </section>
        </TabsContent>

        {/* Tab: Plan */}
        <TabsContent value="plan" className="space-y-6">
          {/* Plan actual y créditos */}
          <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
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
              {(profile.stripe_subscription_id || profile.stripe_customer_id) && (
                <Button variant="outline" size="sm" onClick={handleManageBilling}>
                  Gestionar suscripción
                </Button>
              )}
            </div>
            <div>
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
          </section>

          {/* Uso esta semana */}
          <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" style={{ color: "var(--color-muted-foreground)" }} />
              <h2 className="text-base font-semibold">Uso esta semana</h2>
            </div>
            {usageByAction.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                Sin actividad esta semana.
              </p>
            ) : (
              <ul className="space-y-2">
                {usageByAction.map(({ action, total }) => (
                  <li key={action} className="flex items-center justify-between text-sm">
                    <span>{ACTION_LABELS[action] ?? action}</span>
                    <span className="font-medium tabular-nums">
                      {total} crédito{total !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upgrade de plan (para usuarios que no son Agency) */}
          {upgradePlans.length > 0 && (
            <section className="bg-white rounded-2xl border p-6" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium">Actualizar a:</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setUpgradeBilling("weekly")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      upgradeBilling === "weekly" ? "text-white" : "hover:text-[var(--color-foreground)]"
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
                      upgradeBilling === "annual" ? "text-white" : "hover:text-[var(--color-foreground)]"
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
                {upgradePlans.map((plan) => {
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
                          ? { borderColor: "var(--color-primary)", backgroundColor: "var(--color-primary-light)" }
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
            </section>
          )}

          {/* Recargar créditos */}
          <section className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>

            {topupSuccess && (
              <div
                className="px-6 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: "#ECFDF5", color: "var(--color-success)" }}
              >
                <Check className="w-4 h-4 shrink-0" />
                Créditos añadidos a tu cuenta.
              </div>
            )}

            {/* Cabecera + widget de importe — fondo oscuro */}
            <div className="p-6 pb-8" style={{ backgroundColor: "var(--color-foreground)" }}>
              <div className="flex items-center gap-2 mb-8">
                <Package className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
                <h2 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Recargar créditos</h2>
              </div>

              {/* Importe editable grande */}
              <div className="text-center">
                <div className="flex items-start justify-center">
                  <span
                    className="text-3xl font-medium mt-3 mr-1 select-none"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    €
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={topupInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setTopupInput(raw === "" ? "" : raw);
                    }}
                    onBlur={() => {
                      const clamped = Math.max(5, Math.min(500, parseInt(topupInput) || 5));
                      setTopupInput(String(clamped));
                    }}
                    className="bg-transparent border-none outline-none text-center tabular-nums leading-none font-semibold"
                    style={{
                      fontSize: "clamp(3rem, 12vw, 6rem)",
                      color: "#fff",
                      letterSpacing: "-0.04em",
                      width: `${Math.max(1.5, (topupInput || "0").length + 0.5)}ch`,
                    }}
                  />
                </div>

                {/* Créditos + badge de tier */}
                <div className="flex items-center justify-center gap-2 mt-3">
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {topupCredits} créditos
                  </p>
                  {tier.bonus > 0 && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(140,34,48,0.45)", color: "#F1B1BA" }}
                    >
                      +{tier.bonus}%
                    </span>
                  )}
                </div>

                {/* Nudge hacia el siguiente tier */}
                {nextTier && (
                  <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Desde {nextTier.min}€, {nextTier.rate} créditos/€
                    {tier.bonus === 0
                      ? ` (+${nextTier.bonus}% más)`
                      : ` (+${nextTier.bonus - tier.bonus}% adicional)`}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Presets rápidos */}
              <div className="flex gap-2 flex-wrap">
                {TOPUP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupInput(String(amt))}
                    className="px-4 py-1.5 rounded-full text-sm font-medium border transition-all"
                    style={
                      validAmount === amt
                        ? { backgroundColor: "var(--color-foreground)", color: "#fff", borderColor: "var(--color-foreground)" }
                        : { borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", backgroundColor: "transparent" }
                    }
                  >
                    {amt}€
                  </button>
                ))}
              </div>

              {/* Qué puedes crear — sin emoticonos */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { count: Math.floor(topupCredits / CREDIT_COSTS.generate_script), label: "guiones completos" },
                  { count: Math.floor(topupCredits / CREDIT_COSTS.generate_image), label: "imágenes" },
                  { count: topupCredits * 5, label: "ideas" },
                  { count: Math.floor(topupCredits / CREDIT_COSTS.analyze_channel), label: "análisis de canal" },
                ].map(({ count, label }) => (
                  <div
                    key={label}
                    className="rounded-xl px-3 py-2.5 text-sm"
                    style={{ backgroundColor: "var(--color-muted)" }}
                  >
                    <p className="text-base font-semibold tabular-nums leading-tight">{count}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Toggle pago único / mensual */}
              <div
                className="flex rounded-xl overflow-hidden border"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  onClick={() => setTopupRecurring(false)}
                  className="flex-1 py-2.5 text-sm font-medium transition-all"
                  style={
                    !topupRecurring
                      ? { backgroundColor: "var(--color-foreground)", color: "#fff" }
                      : { color: "var(--color-muted-foreground)" }
                  }
                >
                  Pago único
                </button>
                <button
                  onClick={() => setTopupRecurring(true)}
                  className="flex-1 py-2.5 text-sm font-medium transition-all border-l"
                  style={
                    topupRecurring
                      ? { backgroundColor: "var(--color-foreground)", color: "#fff", borderColor: "var(--color-border)" }
                      : { color: "var(--color-muted-foreground)", borderColor: "var(--color-border)" }
                  }
                >
                  Mensual
                </button>
              </div>

              <div>
                <Button
                  className="w-full h-11"
                  onClick={handleBuyTopup}
                  disabled={buyingTopup || validAmount < 5 || validAmount > 500}
                >
                  {buyingTopup
                    ? "Redirigiendo..."
                    : topupRecurring
                    ? `Añadir ${topupCredits} créditos/mes — ${validAmount},00€/mes`
                    : `Comprar ${topupCredits} créditos — ${validAmount},00€`}
                </Button>
                {topupRecurring && (
                  <p className="text-xs text-center mt-2" style={{ color: "var(--color-muted-foreground)" }}>
                    Se cobra {validAmount},00€ cada mes. Cancela cuando quieras.
                  </p>
                )}
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmación de eliminación */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se borrarán permanentemente todos tus guiones, ideas, imágenes y datos asociados a tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>
              Escribe tu email <span className="font-semibold">{profile.email}</span> para confirmar:
            </Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={profile.email || ""}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={deletingAccount}>Cancelar</Button>
            </DialogClose>
            <Button
              size="sm"
              disabled={deleteConfirm !== profile.email || deletingAccount}
              onClick={handleDeleteAccount}
              style={{ backgroundColor: "var(--color-destructive)", color: "#fff" }}
            >
              {deletingAccount ? "Eliminando..." : "Eliminar cuenta definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pt-6 border-t flex gap-4" style={{ borderColor: "var(--color-border)" }}>
        <Link
          href="/terminos"
          className="text-xs hover:text-[var(--color-foreground)] transition-colors"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Términos de Servicio
        </Link>
        <Link
          href="/privacidad"
          className="text-xs hover:text-[var(--color-foreground)] transition-colors"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Política de Privacidad
        </Link>
      </div>
    </div>
  );
}
