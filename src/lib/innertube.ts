// youtubei.js (InnerTube) helpers — complementary to YouTube Data API v3
// All functions are wrapped in try/catch; they NEVER throw to callers.
// NOTE: Innertube.create() is async and performs an init request each call.
// We create a new instance per call (no singleton) to avoid stale state in serverless.

/* eslint-disable @typescript-eslint/no-explicit-any */

const PERIOD_TO_UPLOAD_DATE: Record<string, string> = {
  '24h': 'today',
  'week': 'this_week',
  'month': 'this_month',
  '3months': 'this_month', // best available approximation
  'year': 'this_year',
};

export interface InnertubeVideoIds {
  country: string;
  period: string;
  contentType: 'short' | 'long' | 'all';
}

/**
 * Returns up to 20 YouTube video IDs for the given filters using InnerTube.
 * Falls back to [] on any error — never throws.
 */
export async function innertubeGetVideoIds({
  country,
  period,
  contentType,
}: InnertubeVideoIds): Promise<string[]> {
  try {
    const { Innertube } = await import('youtubei.js');

    const isGlobal = country === 'GLOBAL';
    const gl = isGlobal ? 'US' : country;
    // Spanish for all Spanish-speaking countries; English for everything else
    const hispanicCountries = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY'];
    const hl = hispanicCountries.includes(gl) ? 'es' : 'en';

    const yt = await Innertube.create({
      gl,
      hl,
      retrieve_player: false,
      generate_session_locally: true,
    } as any);

    const uploadDate = PERIOD_TO_UPLOAD_DATE[period] ?? 'this_week';

    // Map contentType to duration filter
    let duration: string | undefined;
    if (contentType === 'short') duration = 'short';
    else if (contentType === 'long') duration = 'long';

    const searchOpts: any = {
      sort_by: 'view_count',
      upload_date: uploadDate,
      type: 'video',
    };
    if (duration) searchOpts.duration = duration;

    // Build a broad query that yields trending results for the region
    const query = contentType === 'short' ? 'shorts' : 'viral';

    const results = await yt.search(query, searchOpts);

    const ids: string[] = [];
    const videos: any[] = (results as any)?.videos ?? [];

    for (const item of videos) {
      if (ids.length >= 20) break;
      const id = typeof item?.id === 'string' ? item.id : null;
      if (id) ids.push(id);
    }

    return ids;
  } catch {
    // Silent fallback — InnerTube errors must never surface to users
    return [];
  }
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
}

/**
 * Returns the transcript segments for a YouTube video using InnerTube.
 * Falls back to [] on any error or when no transcript is available.
 */
export async function innertubeGetTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    const { Innertube } = await import('youtubei.js');

    const yt = await Innertube.create({
      retrieve_player: false,
      generate_session_locally: true,
    } as any);

    const info = await yt.getInfo(videoId);
    const transcriptData = await (info as any)?.getTranscript?.();

    const segments: TranscriptSegment[] = [];

    // The transcript structure varies across youtubei.js versions — use aggressive optional chaining
    const content =
      transcriptData?.transcript?.content?.body?.initial_segments ??
      transcriptData?.content?.body?.initial_segments ??
      transcriptData?.initial_segments ??
      [];

    for (const seg of content) {
      const text: string =
        seg?.snippet?.text ??
        seg?.text?.runs?.[0]?.text ??
        seg?.text ??
        '';
      const startMs: number =
        seg?.start_ms != null ? Number(seg.start_ms) :
        seg?.startMs != null ? Number(seg.startMs) :
        0;

      if (text) {
        segments.push({ text: String(text).trim(), startMs });
      }
    }

    return segments;
  } catch {
    // Silent fallback
    return [];
  }
}
