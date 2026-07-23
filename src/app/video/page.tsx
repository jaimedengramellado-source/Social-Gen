import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { VideoComingSoon } from "./coming-soon";
import { VideoClient } from "./video-client";
import type { VideoRender } from "@/types";

export default async function VideoPage() {
  // La generación de animaciones queda detrás de flag hasta que haya un worker
  // de render corriendo (ver SETUP.md). Sin el flag, la página sigue en
  // "Próximamente" exactamente como antes.
  if (process.env.ENABLE_VIDEO_GENERATION !== "true") {
    return <VideoComingSoon />;
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: renders }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("video_renders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <VideoClient
      profile={profile!}
      initialRenders={(renders ?? []) as VideoRender[]}
    />
  );
}
