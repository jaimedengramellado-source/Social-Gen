import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// URL pública firmada del proxy de medios (/api/publicaciones/media). TikTok
// exige que las fotos PULL_FROM_URL vengan de un dominio verificado en su
// developer portal, así que se sirven desde el nuestro y no desde supabase.co.
export function mediaProxySignature(path: string, exp: number): string {
  const secret = process.env.MEDIA_PROXY_SECRET ?? process.env.CRON_SECRET;
  if (!secret) throw new Error("Falta MEDIA_PROXY_SECRET o CRON_SECRET para firmar URLs de medios.");
  return createHmac("sha256", secret).update(`${path}:${exp}`).digest("base64url");
}

export function signedMediaProxyUrl(path: string, ttlSeconds = 7_200): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("Falta NEXT_PUBLIC_APP_URL para construir la URL del proxy de medios.");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = mediaProxySignature(path, exp);
  return `${base}/api/publicaciones/media?path=${encodeURIComponent(path)}&exp=${exp}&sig=${sig}`;
}

// El vídeo del bucket publish-videos puede estar compartido por varias
// publicaciones del mismo grupo Y por reglas condicionales en espera:
// borrarlo solo cuando nadie más lo necesite. Funciona con el admin client
// (crons) y con el cliente del usuario (RLS: los paths llevan su prefijo).
export async function releaseStorageIfUnused(
  supabase: SupabaseClient,
  storagePath: string | null,
  opts: { excludePostId?: string; excludeRuleId?: string } = {}
): Promise<void> {
  if (!storagePath) return;

  let postsQuery = supabase
    .from("scheduled_posts")
    .select("id")
    .eq("storage_path", storagePath)
    .in("status", ["uploading", "scheduled", "publishing"])
    .limit(1);
  if (opts.excludePostId) postsQuery = postsQuery.neq("id", opts.excludePostId);
  const { data: posts } = await postsQuery;
  if (posts?.length) return;

  let rulesQuery = supabase
    .from("crosspost_rules")
    .select("id")
    .eq("storage_path", storagePath)
    .eq("status", "waiting")
    .limit(1);
  if (opts.excludeRuleId) rulesQuery = rulesQuery.neq("id", opts.excludeRuleId);
  const { data: rules } = await rulesQuery;
  if (rules?.length) return;

  await supabase.storage.from("publish-videos").remove([storagePath]).catch(() => {});
}
