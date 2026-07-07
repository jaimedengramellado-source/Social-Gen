"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarPage() {
  return (
    <Suspense>
      <RecuperarForm />
    </Suspense>
  );
}

function RecuperarForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "expired_link"
      ? "Ese enlace ha caducado o ya se usó. Solicita uno nuevo."
      : null
  );
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/restablecer")}`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold mb-2">Revisa tu email</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Si existe una cuenta con <strong>{email}</strong>, te hemos enviado un enlace para restablecer tu contraseña.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm text-[var(--color-primary)] hover:underline font-medium"
          >
            ← Volver a entrar
          </Link>
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
          <h1 className="text-xl font-semibold mb-1">¿Olvidaste tu contraseña?</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
            Te enviaremos un enlace a tu email para crear una nueva.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar enlace →"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
          <Link href="/login" className="text-[var(--color-primary)] hover:underline font-medium">
            ← Volver a entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
