"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error no capturado:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">
        Error
      </p>
      <h1
        className="text-3xl md:text-4xl font-normal mb-3"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        Algo ha salido mal
      </h1>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-8 max-w-md">
        Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="bg-[var(--color-foreground)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard"
          className="border border-[var(--color-border)] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-muted)] transition-all"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
