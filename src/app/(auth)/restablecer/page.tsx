"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RestablecerPage() {
  return (
    <Suspense>
      <RestablecerForm />
    </Suspense>
  );
}

function RestablecerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Algunos clientes de email (escáneres de seguridad, previsualizaciones)
  // visitan el enlace del correo antes de que el usuario haga clic, lo que
  // consumiría el código de un solo uso. Por eso el email no enlaza directo
  // a Supabase: enlaza aquí con confirmation_url, y solo un clic real del
  // usuario en el botón de abajo navega al link real que canjea la sesión.
  const confirmationUrl = searchParams.get("confirmation_url");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  if (checkingSession) return null;

  if (!hasSession && confirmationUrl) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-8 shadow-[var(--shadow-card)]">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-semibold mb-2">Restablecer contraseña</h1>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
              Confirma para continuar y elegir una contraseña nueva.
            </p>
            <Button className="w-full" onClick={() => { window.location.href = confirmationUrl; }}>
              Confirmar restablecimiento →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Enlace no válido o caducado</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Solicita un nuevo enlace para restablecer tu contraseña.
          </p>
          <Link
            href="/recuperar"
            className="inline-block mt-6 text-sm text-[var(--color-primary)] hover:underline font-medium"
          >
            Pedir nuevo enlace →
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">Contraseña actualizada</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">Te llevamos a tu cuenta...</p>
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

        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-semibold mb-1">Crea una nueva contraseña</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
            Elige una contraseña nueva para tu cuenta.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirma la contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Actualizar contraseña →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
