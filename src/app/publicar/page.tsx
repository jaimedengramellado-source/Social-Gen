import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PublicarClient } from "./publicar-client";
import { PublicarComingSoon } from "./coming-soon";
import type { CrosspostRule, ScheduledPost, SocialConnection, PostAutomation } from "@/types";

export default async function PublicarPage() {
  const flags = {
    youtube: process.env.ENABLE_YOUTUBE_PUBLISHING === "true",
    instagram: process.env.ENABLE_INSTAGRAM_PUBLISHING === "true",
    facebook: process.env.ENABLE_FACEBOOK_PUBLISHING === "true",
    tiktok: process.env.ENABLE_TIKTOK_PUBLISHING === "true",
    x: process.env.ENABLE_X_PUBLISHING === "true",
    linkedin: process.env.ENABLE_LINKEDIN_PUBLISHING === "true",
    threads: process.env.ENABLE_THREADS_PUBLISHING === "true",
    automations: process.env.ENABLE_AUTOMATIONS === "true",
  };

  // Sin ninguna red activada la página entera queda en "Próximamente"
  // (ver SETUP.md §10-17 para los pasos de activación)
  const anyNetwork =
    flags.youtube || flags.instagram || flags.facebook || flags.tiktok ||
    flags.x || flags.linkedin || flags.threads;
  if (!anyNetwork) {
    return <PublicarComingSoon />;
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ data: ytConn }, { data: socialConns }, { data: posts }, { data: rules }, { data: automations }] =
    await Promise.all([
      supabase
        .from("youtube_connections")
        .select("channel_id, channel_name, channel_thumbnail, scopes")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("social_connections")
        .select("id, user_id, platform, account_id, account_name, account_avatar, page_id, scopes, metadata, created_at, updated_at")
        .eq("user_id", user.id),
      supabase
        .from("scheduled_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("crosspost_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      flags.automations
        ? supabase.from("post_automations").select("*").eq("user_id", user.id).order("threshold")
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <PublicarClient
      flags={flags}
      youtubeConnection={
        ytConn
          ? {
              channelName: ytConn.channel_name,
              channelThumbnail: ytConn.channel_thumbnail,
              canUpload: Boolean(ytConn.scopes?.includes("youtube.upload")),
            }
          : null
      }
      socialConnections={(socialConns ?? []) as SocialConnection[]}
      initialPosts={(posts ?? []) as ScheduledPost[]}
      initialRules={(rules ?? []) as CrosspostRule[]}
      initialAutomations={(automations ?? []) as PostAutomation[]}
    />
  );
}
