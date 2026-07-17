import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractJSON(text: string): string {
  // Remove markdown code fences
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  // Find first [ or { and last ] or }
  const firstBracket = Math.min(
    cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("["),
    cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{")
  );
  const lastBracket = Math.max(
    cleaned.lastIndexOf("]"),
    cleaned.lastIndexOf("}")
  );
  if (firstBracket !== Infinity && lastBracket !== -1) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  return cleaned;
}

// Semilla del chat de /crear al abrir una idea. La clave de sessionStorage la usa el
// dashboard (escritura) y crear-client (lectura); el builder también lo usa el flujo
// /crear?idea= — mantener ambos caminos con el mismo prompt.
export const CREAR_SEED_STORAGE_KEY = "crear-seed-prompt";

export function buildScriptSeedPrompt(title: string, description?: string | null): string {
  return [
    "Escribe un guion completo listo para grabar para este vídeo:",
    "",
    `**${title}**`,
    description ?? "",
    "",
    "Propón antes las variantes de hook, y después el guion completo con desarrollo en 2-3 bloques de contenido con timestamps y CTA final potente.",
  ].filter(Boolean).join("\n");
}

// Semilla del primer mensaje al terminar el onboarding: el contexto de nicho/plataforma/
// tono ya llega al chat vía fetchUserAIContext (perfil recién guardado), así que el
// prompt en sí no necesita repetirlo.
export const ONBOARDING_SEED_PROMPT =
  "Dame 5 ideas de contenido con potencial viral para arrancar mi canal, adaptadas a mi nicho y mi objetivo. Para cada una, incluye un título con gancho y una frase explicando por qué funcionaría.";

export function formatCredits(n: number): string {
  return n.toLocaleString("es-ES");
}

export function getViralScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export function getViralScoreBorder(score: number): string {
  if (score >= 90) return "border-emerald-500 bg-emerald-50";
  if (score >= 70) return "border-green-500 bg-green-50";
  if (score >= 40) return "border-amber-500 bg-amber-50";
  return "border-red-500 bg-red-50";
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export async function downloadImageFromUrl(url: string, filename = "imagen.png") {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
