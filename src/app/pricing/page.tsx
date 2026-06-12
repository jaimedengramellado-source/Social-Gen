import { LandingPricing } from "@/components/landing/pricing-section";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <nav className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-normal" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Social Gen
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Entrar</Link>
            <Link href="/signup" className="bg-[var(--color-foreground)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all">
              Empieza gratis
            </Link>
          </div>
        </div>
      </nav>
      <LandingPricing />
    </div>
  );
}
