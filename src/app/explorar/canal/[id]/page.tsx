import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { getChannel } from "@/lib/youtube";
import { CanalView } from "./canal-view";
import type { Profile } from "@/types";

export default async function CanalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [profileRes, watchlistRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("watchlist_channels").select("channel_url").eq("user_id", user.id),
  ]);

  const profile = profileRes.data as Profile;
  const watchlistIds = (watchlistRes.data ?? []).map(w => w.channel_url);

  let channelData = null;
  let ytError = false;
  try {
    channelData = await getChannel(id);
  } catch {
    ytError = true;
  }

  if (!channelData && !ytError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-muted-foreground)]">Canal no encontrado.</p>
      </div>
    );
  }

  if (ytError || !channelData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">No se pudo cargar el canal</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Comprueba que <code>YOUTUBE_API_KEY</code> está configurada en <code>.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  const { channel, videos } = channelData;

  const freqLabel = (() => {
    if (videos.length < 2) return "Sin datos";
    const dates = videos.map(v => new Date(v.publishedAt).getTime()).sort((a, b) => b - a);
    const totalDays = (dates[0] - dates[dates.length - 1]) / 86400000;
    const perWeek = (videos.length / totalDays) * 7;
    return perWeek >= 1
      ? `${perWeek.toFixed(1)} vídeos/sem`
      : `${(perWeek * 4.33).toFixed(1)} vídeos/mes`;
  })();

  return (
    <CanalView
      channel={channel}
      videos={videos}
      freqLabel={freqLabel}
      profile={profile}
      initialInWatchlist={watchlistIds.includes(id)}
    />
  );
}
