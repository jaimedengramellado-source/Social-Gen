import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getVideo } from "@/lib/youtube";
import { innertubeGetTranscript } from "@/lib/innertube";
import { VideoView } from "./video-view";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  let result = null;
  let error = false;
  try {
    result = await getVideo(id);
  } catch {
    error = true;
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">No se pudo cargar el vídeo</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">ID incorrecto o API key no configurada.</p>
        </div>
      </div>
    );
  }

  // Fetch transcript in parallel — silently falls back to [] on any error
  let transcript: { text: string; startMs: number }[] = [];
  try {
    transcript = await innertubeGetTranscript(id);
  } catch {
    transcript = [];
  }

  return (
    <VideoView
      video={result.video}
      channel={result.channel}
      channelAvgViews={result.channelAvgViews}
      channelRecentVideos={result.channelRecentVideos}
      transcript={transcript}
    />
  );
}
