import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">
        404
      </p>
      <h1
        className="text-3xl md:text-4xl font-normal mb-3"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        Esta página no existe
      </h1>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-8 max-w-md">
        El enlace puede estar roto o la página se ha movido.
      </p>
      <Link
        href="/"
        className="bg-[var(--color-foreground)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
