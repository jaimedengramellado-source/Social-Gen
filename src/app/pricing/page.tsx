import { LandingPricing } from "@/components/landing/pricing-section";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shared/logo";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { plan, billing } = await searchParams;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard" className="bg-[var(--color-foreground)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all">
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Entrar</Link>
                <Link href="/signup" className="bg-[var(--color-foreground)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all">
                  Empieza gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <div className="pt-20">
        <LandingPricing loggedIn={!!user} autoPlan={plan} autoBilling={billing} />
      </div>
    </div>
  );
}
