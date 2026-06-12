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
