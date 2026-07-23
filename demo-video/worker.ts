// Worker de render de animaciones. Hace poll de video_renders (status=queued),
// renderiza la composición Remotion correspondiente y sube el MP4 al bucket
// privado `videos` de Supabase Storage. Corre fuera de Vercel (máquina local o
// VPS): un render tarda decenas de segundos y necesita Chrome headless.
//
// Uso: crear demo-video/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
// luego `pnpm worker` (ver SETUP.md).

import fs from "fs";
import os from "os";
import path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Mapea video_renders.template → id de composición en src/Root.tsx.
// Debe ir en sincronía con src/lib/video/templates.ts de la app principal.
const COMPOSITIONS: Record<string, string> = {
  "hook-card": "TplHookCard",
  "list-card": "TplListCard",
};

const POLL_MS = 5000;
const STALE_RENDERING_MINUTES = 10;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;

interface RenderJob {
  id: string;
  user_id: string;
  template: string;
  props: Record<string, unknown>;
  duration_seconds: number;
  credits_spent: number;
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

let stopping = false;

async function requeueStale(sb: SupabaseClient) {
  const cutoff = new Date(Date.now() - STALE_RENDERING_MINUTES * 60 * 1000).toISOString();
  const { data } = await sb
    .from("video_renders")
    .update({ status: "queued", claimed_at: null, updated_at: new Date().toISOString() })
    .eq("status", "rendering")
    .lt("claimed_at", cutoff)
    .select("id");
  if (data && data.length > 0) {
    console.log(`[worker] re-encolados ${data.length} jobs colgados`);
  }
}

async function claimNext(sb: SupabaseClient): Promise<RenderJob | null> {
  const { data: candidates } = await sb
    .from("video_renders")
    .select("id, user_id, template, props, duration_seconds, credits_spent")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  const job = candidates?.[0] as RenderJob | undefined;
  if (!job) return null;

  // Claim optimista: solo gana el worker cuyo update encuentre el job aún queued.
  const { data: claimed } = await sb
    .from("video_renders")
    .update({ status: "rendering", claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id");

  return claimed && claimed.length > 0 ? job : null;
}

async function refund(sb: SupabaseClient, job: RenderJob) {
  if (!job.credits_spent) return;
  await sb.rpc("add_credits", { p_user_id: job.user_id, p_amount: job.credits_spent });
  await sb.from("usage_logs").insert({
    user_id: job.user_id,
    action: "refund_generate_video",
    credits_spent: -job.credits_spent,
    metadata: { render_id: job.id },
  });
}

async function renderJob(sb: SupabaseClient, serveUrl: string, job: RenderJob) {
  const compositionId = COMPOSITIONS[job.template];
  if (!compositionId) throw new Error(`plantilla desconocida: ${job.template}`);

  const inputProps = { ...job.props, durationInSeconds: job.duration_seconds };
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });

  const outPath = path.join(os.tmpdir(), `sf-render-${job.id}.mp4`);
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
    });

    const storagePath = `${job.user_id}/${job.id}.mp4`;
    const { error: uploadError } = await sb.storage
      .from("videos")
      .upload(storagePath, fs.readFileSync(outPath), { contentType: "video/mp4", upsert: true });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await sb.storage
      .from("videos")
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (signError || !signed) throw signError ?? new Error("no signed url");

    await sb
      .from("video_renders")
      .update({
        status: "done",
        storage_path: storagePath,
        video_url: signed.signedUrl,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (crea demo-video/.env)");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log("[worker] empaquetando composiciones Remotion…");
  const serveUrl = await bundle({
    entryPoint: path.join(__dirname, "src", "index.ts"),
    webpackOverride: (config) => enableTailwind(config),
  });
  console.log("[worker] bundle listo, esperando jobs (Ctrl+C para parar)");

  process.on("SIGINT", () => {
    stopping = true;
    console.log("\n[worker] parando tras el job en curso…");
  });

  while (!stopping) {
    try {
      await requeueStale(sb);
      const job = await claimNext(sb);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      console.log(`[worker] render ${job.id} (${job.template}, ${job.duration_seconds}s)`);
      const started = Date.now();
      try {
        await renderJob(sb, serveUrl, job);
        console.log(`[worker] ✔ ${job.id} en ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        console.error(`[worker] ✖ ${job.id}:`, err);
        await sb
          .from("video_renders")
          .update({
            status: "error",
            error: err instanceof Error ? err.message.slice(0, 500) : "render failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        await refund(sb, job);
      }
    } catch (err) {
      // Error de infraestructura (red, Supabase caído): esperar y seguir.
      console.error("[worker] error de loop:", err);
      await new Promise((r) => setTimeout(r, POLL_MS * 2));
    }
  }
  process.exit(0);
}

main();
