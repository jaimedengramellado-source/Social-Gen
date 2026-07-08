import { Video, Sparkles, Clapperboard, Wand2 } from "lucide-react";

const FEATURES = [
  { label: "Guiones a vídeo", Icon: Clapperboard },
  { label: "Animaciones con IA", Icon: Wand2 },
  { label: "Edición automática", Icon: Sparkles },
];

export default function VideoPage() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-3xl pointer-events-none"
        style={{ backgroundColor: "var(--color-primary)" }}
      />

      <div className="relative animate-fade-up">
        {/* Icon */}
        <div className="relative mx-auto mb-8 w-20 h-20">
          <div
            className="absolute inset-0 rounded-3xl animate-pulse-slow"
            style={{ backgroundColor: "var(--color-primary-light)" }}
          />
          <div
            className="absolute inset-0 rounded-3xl flex items-center justify-center border"
            style={{ borderColor: "var(--color-primary-light)" }}
          >
            <Video size={30} strokeWidth={1.6} style={{ color: "var(--color-primary)" }} />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-light)] bg-[var(--color-primary-light)] px-4 py-1.5 text-xs font-semibold text-[var(--color-primary)] mb-6">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-primary)]" />
          </span>
          Próximamente
        </div>

        {/* Headline */}
        <h1
          className="text-4xl md:text-5xl font-normal mb-4"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Vídeo y{" "}
          <span style={{ fontStyle: "italic", color: "var(--color-primary)" }}>
            animaciones
          </span>
        </h1>
        <p className="text-sm md:text-base text-[var(--color-muted-foreground)] max-w-md mx-auto mb-10">
          Convierte tus guiones en vídeo y genera animaciones con IA directamente
          desde Social Flamingo. Lo estamos preparando.
        </p>

        {/* Feature chips */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {FEATURES.map(({ label, Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-[var(--shadow-card)]"
            >
              <Icon size={13} strokeWidth={1.8} style={{ color: "var(--color-primary)" }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
