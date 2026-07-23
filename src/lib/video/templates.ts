// Catálogo de plantillas de animación. Compartido entre la UI (selector), el
// endpoint (schema de structured outputs) y documenta el contrato con el worker
// de Remotion (demo-video/worker.ts), que mapea template.id → compositionId.
// Si añades una plantilla aquí, añade también su composición en demo-video/src/Root.tsx
// y su rama en el worker.

export const VIDEO_DURATIONS = [6, 10, 15] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export interface VideoTemplate {
  id: string;
  compositionId: string;
  name: string;
  description: string;
  aiGuidance: string;
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "hook-card",
    compositionId: "TplHookCard",
    name: "Hook animado",
    description: "Una frase gancho que aparece palabra a palabra sobre fondo de marca. Ideal para abrir un vídeo o como teaser.",
    aiGuidance:
      "Elige hook-card cuando el usuario quiera destacar UNA sola frase potente: un gancho, una cita, una pregunta provocadora. Rellena el campo `hook` con la frase (máx 90 caracteres, sin comillas).",
  },
  {
    id: "list-card",
    compositionId: "TplListCard",
    name: "Lista con reveals",
    description: "Un título y 3-5 puntos que van apareciendo uno a uno. Ideal para tips, errores comunes o rankings.",
    aiGuidance:
      "Elige list-card cuando el contenido sea enumerable: tips, errores, pasos, razones. Rellena `title` (máx 50 caracteres) e `items` (3-5 elementos, máx 60 caracteres cada uno, sin numerar — la plantilla ya los numera).",
  },
];

export function getVideoTemplate(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

export function clampDuration(seconds: number | undefined): VideoDuration {
  if (seconds && (VIDEO_DURATIONS as readonly number[]).includes(seconds)) {
    return seconds as VideoDuration;
  }
  return 6;
}
