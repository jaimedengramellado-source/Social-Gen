"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const AI_INSTRUCTION_EXAMPLES = [
  "ej. Nunca uses la palabra 'chicos' — yo saludo siempre con '¡Hola familia!'",
  "ej. Mis guiones siempre: hook de 3 segundos, 3 puntos rápidos y cierro con una pregunta",
  "ej. No me propongas bailes ni tendencias de audio, solo contenido hablado a cámara",
  "ej. Le hablo a madres primerizas de 30-40 años, siempre de tú y sin tecnicismos",
  "ej. Evita el humor sarcástico: mi tono es cercano y motivador, nunca burlón",
];

// Placeholder "vivo" para textareas: superpone ejemplos que rotan con fundido
// mientras el campo está vacío. El wrapper del textarea debe ser `relative` y
// compartir padding (px-3 py-2 text-sm) con este overlay.
export function RotatingPlaceholder({
  examples,
  active,
  intervalMs = 4000,
}: {
  examples: string[];
  active: boolean;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % examples.length), intervalMs);
    return () => clearInterval(timer);
  }, [active, examples.length, intervalMs]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 px-3 py-2 text-sm text-[var(--color-muted-foreground)]"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="block"
        >
          {examples[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
