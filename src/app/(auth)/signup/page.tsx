"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, MailOpen } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { planCheckoutPath } from "@/lib/plan-intent";
import { PlanSteps } from "@/components/shared/plan-steps";
import { CelebrationBurst } from "@/components/shared/celebration-burst";
import { PRICING_PLANS } from "@/types";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

// Supabase devuelve los errores de auth en inglés; traducimos los habituales.
function signupErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con ese email. Prueba a iniciar sesión.";
  if (m.includes("password") && (m.includes("at least") || m.includes("weak")))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("invalid email") || m.includes("valid email"))
    return "Ese email no parece válido. Revísalo e inténtalo de nuevo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.";
  return "No se ha podido crear la cuenta. Inténtalo de nuevo en unos segundos.";
}

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const billing = searchParams.get("billing") === "annual" ? "annual" : "weekly";
  const nextPath = planCheckoutPath(plan, billing);
  const planName = nextPath ? PRICING_PLANS.find((p) => p.id === plan)?.name : null;
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: callbackUrl(),
      },
    });

    if (error) {
      setError(signupErrorMessage(error.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogle() {
    if (!acceptedTerms) {
      setError("Debes aceptar los términos y condiciones para crear tu cuenta.");
      return;
    }
    setError(null);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm text-center">
          {nextPath && <PlanSteps current={1} />}
          <CelebrationBurst
            className="mb-6"
            icon={<MailOpen className="h-9 w-9" style={{ color: "var(--color-primary)" }} />}
            badge={<Check className="h-4 w-4 text-white" strokeWidth={3} />}
          />
          <motion.h2
            className="text-xl font-semibold mb-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15, ease: "easeOut" }}
          >
            ¡Cuenta creada!
          </motion.h2>
          <motion.p
            className="text-[var(--color-muted-foreground)] text-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
          >
            Hemos enviado un enlace de confirmación a <strong>{email}</strong>. Haz clic en el enlace para activar tu cuenta.
          </motion.p>
          {nextPath && (
            <motion.p
              className="text-[var(--color-muted-foreground)] text-sm mt-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.35, ease: "easeOut" }}
            >
              Al confirmar, continuarás con el pago y después configurarás tu IA.
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {nextPath && <PlanSteps current={1} />}

        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-semibold mb-1">{nextPath ? "Crea tu cuenta" : "Crea tu cuenta gratis"}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
            {nextPath ? "Paso 1 de 3 para empezar a crecer." : "5 créditos incluidos. Sin tarjeta de crédito."}
          </p>

          {planName && (
            <div className="mb-4 rounded-lg border border-[var(--color-success)] bg-[var(--bg-success)] px-3 py-2.5 text-sm text-[var(--text-success)]">
              Plan de <strong>{planName}</strong> en camino.
            </div>
          )}

          <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogle}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Registrarse con Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-[var(--color-muted-foreground)]">o con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--color-border)]"
                style={{ accentColor: "var(--color-primary)" }}
              />
              <label
                htmlFor="terms"
                className="text-xs text-[var(--color-muted-foreground)] cursor-pointer select-none leading-relaxed"
              >
                He leído y acepto los{" "}
                <Link href="/terminos" target="_blank" className="text-[var(--color-primary)] hover:underline font-medium">
                  términos y condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" target="_blank" className="text-[var(--color-primary)] hover:underline font-medium">
                  política de privacidad
                </Link>
                .
              </label>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta gratis →"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={nextPath ? `/login?plan=${plan}&billing=${billing}` : "/login"}
            className="text-[var(--color-primary)] hover:underline font-medium"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
