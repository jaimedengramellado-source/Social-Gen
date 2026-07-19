import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingGuarantees } from "@/components/landing/guarantees";
import { LandingPricing } from "@/components/landing/pricing-section";
import { LandingFaq } from "@/components/landing/faq";

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="hidden md:block text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            >
              Precios
            </Link>
            <Link
              href="/login"
              className="hidden md:block text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-primary-hover)] hover:-translate-y-px"
            >
              Empieza gratis →
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <LandingHero />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingGuarantees />
        <LandingPricing />
        <LandingFaq />
      </main>

      <footer className="border-t border-[var(--color-border)] py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            © {new Date().getFullYear()} Social Flamingo. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Precios</Link>
            <Link href="/terminos" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Términos</Link>
            <Link href="/privacidad" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Privacidad</Link>
            <Link href="/login" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
