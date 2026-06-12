import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { LandingHero } from "@/components/landing/hero";
import { LandingFeatures } from "@/components/landing/features";
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
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-foreground)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 hover:-translate-y-px"
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
        <LandingPricing />
        <LandingFaq />
      </main>

      <footer className="border-t border-[var(--color-border)] py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            © 2025 Social Gen. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Precios</Link>
            <Link href="/login" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LandingHowItWorks() {
  const steps = [
    { num: "01", title: "Elige tu plataforma y nicho", desc: "Selecciona YouTube, TikTok o Reels. Describe tu canal en una frase." },
    { num: "02", title: "Responde 3 preguntas rápidas", desc: "La IA personaliza las ideas a tu audiencia y estilo de contenido." },
    { num: "03", title: "Obtén tu guion viral en 30 segundos", desc: "Recibe 10 ideas con viral score + guion completo listo para grabar." },
  ];

  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">Cómo funciona</p>
        <h2
          className="text-4xl md:text-5xl font-normal mb-16 leading-tight"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Tu primer guion viral<br />en menos de 3 minutos.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step) => (
            <div key={step.num} className="flex flex-col gap-4">
              <span
                className="text-7xl font-normal text-[var(--color-border)]"
                style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.04em" }}
              >
                {step.num}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
