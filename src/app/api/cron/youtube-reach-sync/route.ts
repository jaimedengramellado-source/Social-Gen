import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { gunzipSync } from "zlib";

// Sincroniza CTR/impresiones de miniatura (youtube_reach_stats) desde la
// YouTube Reporting API. Estos datos NO existen en la API interactiva de
// Analytics (ver src/lib/youtube-analytics.ts) — solo vía reportes bulk que
// Google genera con ~48h de retraso. Este cron: 1) crea el job de reporting
// una vez por canal si no existe, 2) lista reportes nuevos desde el último
// sync, 3) descarga y parsea el CSV, 4) hace upsert por (user_id, video_id, date).
const REPORT_TYPE_ID = "channel_reach_basic_a1";

type Connection = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  created_at: string;
  reporting_job_id: string | null;
  reach_synced_until: string | null;
};

async function refreshToken(
  conn: Connection,
  supabaseAdmin: SupabaseClient
): Promise<string | null> {
  if (new Date(conn.expires_at) > new Date(Date.now() + 60_000)) return conn.access_token;
  if (!conn.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) return null;

  await supabaseAdmin.from("youtube_connections").update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", conn.user_id);

  return data.access_token;
}

async function ensureReportingJob(
  token: string,
  conn: Connection,
  supabaseAdmin: SupabaseClient
): Promise<string | null> {
  if (conn.reporting_job_id) return conn.reporting_job_id;

  const res = await fetch("https://youtubereporting.googleapis.com/v1/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reportTypeId: REPORT_TYPE_ID, name: `viralcraft-reach-${conn.user_id}` }),
  });
  const data = await res.json();
  if (!data.id) {
    console.error("[youtube-reach-sync] job create failed:", JSON.stringify(data.error ?? data));
    return null;
  }

  await supabaseAdmin.from("youtube_connections").update({ reporting_job_id: data.id }).eq("user_id", conn.user_id);
  return data.id;
}

function parseReachCsv(csv: string): { video_id: string; date: string; impressions: number; ctr: number }[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const col = (name: string) => header.indexOf(name);
  const dateIdx = col("date");
  const videoIdx = col("video_id");
  const impIdx = col("video_thumbnail_impressions");
  const ctrIdx = col("video_thumbnail_impressions_ctr");
  if (dateIdx < 0 || videoIdx < 0 || impIdx < 0 || ctrIdx < 0) return [];

  const rows: { video_id: string; date: string; impressions: number; ctr: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < header.length) continue;
    rows.push({
      video_id: cols[videoIdx],
      date: cols[dateIdx],
      impressions: Number(cols[impIdx] ?? 0),
      ctr: Number(cols[ctrIdx] ?? 0),
    });
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: connections, error } = await supabaseAdmin.from("youtube_connections").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, string> = {};

  for (const conn of (connections ?? []) as Connection[]) {
    try {
      const token = await refreshToken(conn, supabaseAdmin);
      if (!token) { results[conn.user_id] = "token_error"; continue; }

      const jobId = await ensureReportingJob(token, conn, supabaseAdmin);
      if (!jobId) { results[conn.user_id] = "job_error"; continue; }

      const since = conn.reach_synced_until ?? conn.created_at;
      const listUrl = new URL(`https://youtubereporting.googleapis.com/v1/jobs/${jobId}/reports`);
      listUrl.searchParams.set("startTimeAtOrAfter", since);
      const listRes = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const listData = await listRes.json();
      const reports: { downloadUrl?: string }[] = listData.reports ?? [];

      let totalRows = 0;
      for (const report of reports) {
        if (!report.downloadUrl) continue;
        const fileRes = await fetch(report.downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
        const buf = Buffer.from(await fileRes.arrayBuffer());
        let csv: string;
        try { csv = gunzipSync(buf).toString("utf-8"); }
        catch { csv = buf.toString("utf-8"); }

        const rows = parseReachCsv(csv).map(r => ({
          ...r,
          user_id: conn.user_id,
          synced_at: new Date().toISOString(),
        }));
        if (rows.length > 0) {
          const { error: upsertError } = await supabaseAdmin
            .from("youtube_reach_stats")
            .upsert(rows, { onConflict: "user_id,video_id,date" });
          if (upsertError) console.error("[youtube-reach-sync] upsert error:", upsertError.message);
          else totalRows += rows.length;
        }
      }

      await supabaseAdmin.from("youtube_connections")
        .update({ reach_synced_until: new Date().toISOString() })
        .eq("user_id", conn.user_id);
      results[conn.user_id] = `ok:${totalRows}`;
    } catch (err) {
      console.error(`[youtube-reach-sync] error for user ${conn.user_id}:`, err);
      results[conn.user_id] = "exception";
    }
  }

  return NextResponse.json({ synced: results });
}
