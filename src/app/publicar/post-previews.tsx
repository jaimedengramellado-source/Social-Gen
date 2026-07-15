"use client";

import {
  Heart, MessageCircle, Share2, Music2, ThumbsUp, ThumbsDown, Repeat2, Send,
  Bookmark, MoreHorizontal, BarChart2, Film, Globe,
} from "lucide-react";
import type { PublishPlatform } from "@/types";

export interface PreviewAccount {
  name: string | null;
  avatar: string | null;
}

interface Props {
  platform: PublishPlatform;
  videoUrl: string | null;
  mediaType?: "video" | "image";
  text: string;
  title?: string;
  account?: PreviewAccount | null;
}

function Avatar({ src, name, size }: { src: string | null | undefined; name: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, backgroundColor: "#8C2230", fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function VideoFill({ url, mediaType }: { url: string | null; mediaType?: "video" | "image" }) {
  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(160deg,#1c1c26,#2c2434)" }}>
        <Film size={28} style={{ color: "rgba(255,255,255,0.35)" }} />
      </div>
    );
  }
  if (mediaType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />;
  }
  return <video src={url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />;
}

// Media de las tarjetas de feed (X, LinkedIn, Facebook, Threads)
function CardMedia({
  url, mediaType, maxHeight, emptyBg, emptyIconClass,
}: {
  url: string | null;
  mediaType?: "video" | "image";
  maxHeight: number;
  emptyBg: string;
  emptyIconClass: string;
}) {
  if (!url) {
    return (
      <div className="w-full h-40 flex items-center justify-center" style={{ backgroundColor: emptyBg }}>
        <Film size={22} className={emptyIconClass} />
      </div>
    );
  }
  if (mediaType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full object-cover" style={{ maxHeight }} />;
  }
  return <video src={url} autoPlay muted loop playsInline className="w-full object-cover" style={{ maxHeight }} />;
}

// ── Redes fullscreen (vídeo vertical con overlay) ──

function FullscreenRail({ items }: { items: Array<{ icon: React.ElementType; label: string }> }) {
  return (
    <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3.5">
      {items.map(({ icon: Icon, label }, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <Icon size={20} className="text-white drop-shadow" fill={Icon === Heart ? "white" : "none"} />
          <span className="text-[8px] text-white/90 font-semibold drop-shadow">{label}</span>
        </div>
      ))}
    </div>
  );
}

function TikTokPreview({ videoUrl, mediaType, text, account }: Props) {
  const user = account?.name?.replace(/^@/, "") ?? "tucuenta";
  return (
    <div className="relative w-full h-full bg-black">
      <VideoFill url={videoUrl} mediaType={mediaType} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />
      <div className="absolute top-2.5 inset-x-0 flex justify-center gap-3 text-[10px] font-semibold">
        <span className="text-white/60">Siguiendo</span>
        <span className="text-white border-b-2 border-white pb-0.5">Para ti</span>
      </div>
      <FullscreenRail
        items={[
          { icon: Heart, label: "127K" },
          { icon: MessageCircle, label: "1.408" },
          { icon: Bookmark, label: "12K" },
          { icon: Share2, label: "8.502" },
        ]}
      />
      <div className="absolute bottom-3 left-2.5 right-12">
        <p className="text-white text-[11px] font-bold mb-1">@{user}</p>
        <p className="text-white text-[10px] leading-snug line-clamp-2 whitespace-pre-wrap">
          {text || "Tu texto aparecerá aquí..."}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Music2 size={9} className="text-white" />
          <span className="text-white text-[9px] truncate">sonido original - {user}</span>
        </div>
      </div>
    </div>
  );
}

function ReelsPreview({ videoUrl, mediaType, text, account }: Props) {
  const user = account?.name?.replace(/^@/, "") ?? "tucuenta";
  return (
    <div className="relative w-full h-full bg-black">
      <VideoFill url={videoUrl} mediaType={mediaType} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      <p className="absolute top-3 left-3 text-white text-[13px] font-bold drop-shadow">Reels</p>
      <FullscreenRail
        items={[
          { icon: Heart, label: "84,1K" },
          { icon: MessageCircle, label: "932" },
          { icon: Send, label: "" },
          { icon: MoreHorizontal, label: "" },
        ]}
      />
      <div className="absolute bottom-3 left-2.5 right-12">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Avatar src={account?.avatar} name={user} size={20} />
          <span className="text-white text-[10px] font-bold">{user}</span>
          <span className="text-white text-[9px] border border-white/70 rounded-md px-1.5 py-px">Seguir</span>
        </div>
        <p className="text-white text-[10px] leading-snug line-clamp-2 whitespace-pre-wrap">
          {text || "Tu caption aparecerá aquí..."}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Music2 size={9} className="text-white" />
          <span className="text-white text-[9px] truncate">{user} · Audio original</span>
        </div>
      </div>
    </div>
  );
}

function ShortsPreview({ videoUrl, text, title, account }: Props) {
  const channel = account?.name ?? "Tu canal";
  return (
    <div className="relative w-full h-full bg-black">
      <VideoFill url={videoUrl} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      <p className="absolute top-3 left-3 text-white text-[13px] font-bold drop-shadow">Shorts</p>
      <FullscreenRail
        items={[
          { icon: ThumbsUp, label: "45K" },
          { icon: ThumbsDown, label: "No me..." },
          { icon: MessageCircle, label: "512" },
          { icon: Share2, label: "Compartir" },
        ]}
      />
      <div className="absolute bottom-3 left-2.5 right-12">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Avatar src={account?.avatar} name={channel} size={20} />
          <span className="text-white text-[10px] font-bold truncate">@{channel.replace(/^@/, "").replace(/\s+/g, "").toLowerCase()}</span>
          <span className="text-[9px] font-semibold bg-white text-black rounded-full px-2 py-0.5">Suscribirme</span>
        </div>
        <p className="text-white text-[10px] leading-snug line-clamp-2">
          {title || "El título de tu vídeo"}
        </p>
        {text && <p className="text-white/75 text-[9px] leading-snug line-clamp-1 mt-0.5">{text}</p>}
      </div>
    </div>
  );
}

// ── Redes de feed (tarjeta de post) ──

function CardActionRow({ items, color }: { items: Array<{ icon: React.ElementType; label?: string }>; color: string }) {
  return (
    <div className="flex items-center justify-between mt-2 pr-4">
      {items.map(({ icon: Icon, label }, i) => (
        <span key={i} className="flex items-center gap-1" style={{ color }}>
          <Icon size={13} />
          {label && <span className="text-[9px]">{label}</span>}
        </span>
      ))}
    </div>
  );
}

function XPreview({ videoUrl, mediaType, text, account }: Props) {
  const user = account?.name?.replace(/^@/, "") ?? "tucuenta";
  return (
    <div className="w-full h-full bg-black overflow-hidden px-3 pt-10">
      <div className="flex gap-2">
        <Avatar src={account?.avatar} name={user} size={26} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] leading-tight">
            <span className="text-white font-bold">{user}</span>{" "}
            <span className="text-[#71767b]">@{user} · 1 min</span>
          </p>
          <p className="text-white text-[11px] leading-snug mt-0.5 whitespace-pre-wrap break-words line-clamp-6">
            {text || "Tu post aparecerá aquí..."}
          </p>
          <div className="mt-2 rounded-xl overflow-hidden border border-[#2f3336]">
            <CardMedia url={videoUrl} mediaType={mediaType} maxHeight={200} emptyBg="#16181c" emptyIconClass="text-white/30" />
          </div>
          <CardActionRow
            color="#71767b"
            items={[
              { icon: MessageCircle, label: "48" },
              { icon: Repeat2, label: "112" },
              { icon: Heart, label: "1,4K" },
              { icon: BarChart2, label: "89K" },
              { icon: Share2 },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ videoUrl, mediaType, text, account }: Props) {
  const name = account?.name ?? "Tu nombre";
  return (
    <div className="w-full h-full overflow-hidden pt-9" style={{ backgroundColor: "#f4f2ee" }}>
      {/* Colores fijos (no clases del tema): el mockup debe verse igual en modo oscuro */}
      <div className="mx-1.5 rounded-lg border border-black/10 px-3 pt-2.5 pb-2" style={{ backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2 mb-2">
          <Avatar src={account?.avatar} name={name} size={28} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-black leading-tight truncate">{name}</p>
            <p className="text-[9px] text-black/55 leading-tight flex items-center gap-0.5">
              Creador de contenido · Ahora · <Globe size={8} />
            </p>
          </div>
        </div>
        <p className="text-[11px] text-black leading-snug whitespace-pre-wrap break-words line-clamp-3">
          {text || "Tu post aparecerá aquí..."}
        </p>
        <p className="text-[10px] text-black/50 mb-1.5">…ver más</p>
        <div className="-mx-3">
          <CardMedia url={videoUrl} mediaType={mediaType} maxHeight={190} emptyBg="#e8e6e1" emptyIconClass="text-black/25" />
        </div>
        <div className="flex items-center justify-around pt-1.5 mt-0.5 border-t border-black/10">
          {[
            { icon: ThumbsUp, label: "Recomendar" },
            { icon: MessageCircle, label: "Comentar" },
            { icon: Repeat2, label: "Compartir" },
            { icon: Send, label: "Enviar" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex flex-col items-center gap-0.5 text-black/60">
              <Icon size={12} />
              <span className="text-[8px] font-medium">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ videoUrl, mediaType, text, account }: Props) {
  const name = account?.name ?? "Tu página";
  return (
    <div className="w-full h-full overflow-hidden pt-9" style={{ backgroundColor: "#f0f2f5" }}>
      <div className="mx-1.5 rounded-lg border border-black/10" style={{ backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-2 px-3 pt-2.5 mb-2">
          <Avatar src={account?.avatar} name={name} size={28} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-black leading-tight truncate">{name}</p>
            <p className="text-[9px] text-black/55 leading-tight flex items-center gap-0.5">
              Ahora · <Globe size={8} />
            </p>
          </div>
          <MoreHorizontal size={13} className="ml-auto text-black/50" />
        </div>
        <p className="px-3 text-[11px] text-black leading-snug whitespace-pre-wrap break-words line-clamp-3 mb-1.5">
          {text || "Tu post aparecerá aquí..."}
        </p>
        <CardMedia url={videoUrl} mediaType={mediaType} maxHeight={200} emptyBg="#e8e6e1" emptyIconClass="text-black/25" />
        <div className="flex items-center justify-around py-1.5 mx-3 border-t border-black/10">
          {[
            { icon: ThumbsUp, label: "Me gusta" },
            { icon: MessageCircle, label: "Comentar" },
            { icon: Share2, label: "Compartir" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 text-black/60">
              <Icon size={12} />
              <span className="text-[9px] font-medium">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThreadsPreview({ videoUrl, mediaType, text, account }: Props) {
  const user = account?.name?.replace(/^@/, "") ?? "tucuenta";
  return (
    <div className="w-full h-full overflow-hidden px-3 pt-9" style={{ backgroundColor: "#ffffff" }}>
      <p className="text-center text-[12px] font-bold text-black mb-3">Para ti</p>
      <div className="flex gap-2">
        <Avatar src={account?.avatar} name={user} size={26} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] leading-tight">
            <span className="text-black font-semibold">{user}</span>{" "}
            <span className="text-black/40">1 min</span>
          </p>
          <p className="text-black text-[11px] leading-snug mt-0.5 whitespace-pre-wrap break-words line-clamp-5">
            {text || "Tu post aparecerá aquí..."}
          </p>
          <div className="mt-2 rounded-xl overflow-hidden border border-black/10">
            <CardMedia url={videoUrl} mediaType={mediaType} maxHeight={200} emptyBg="#f0efe9" emptyIconClass="text-black/25" />
          </div>
          <CardActionRow
            color="rgba(0,0,0,0.65)"
            items={[
              { icon: Heart, label: "620" },
              { icon: MessageCircle, label: "37" },
              { icon: Repeat2, label: "12" },
              { icon: Send },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// Las fotos de Instagram van al feed, no a Reels: tarjeta de post clásica
function InstagramPhotoPreview({ videoUrl, text, account }: Props) {
  const user = account?.name?.replace(/^@/, "") ?? "tucuenta";
  return (
    <div className="w-full h-full overflow-hidden pt-9" style={{ backgroundColor: "#ffffff" }}>
      <div className="flex items-center gap-2 px-3 mb-2">
        <Avatar src={account?.avatar} name={user} size={24} />
        <p className="text-[11px] font-semibold text-black truncate">{user}</p>
        <MoreHorizontal size={13} className="ml-auto text-black/60" />
      </div>
      {videoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={videoUrl} alt="" className="w-full object-cover" style={{ maxHeight: 260 }} />
      ) : (
        <div className="w-full h-52 flex items-center justify-center" style={{ backgroundColor: "#f0efe9" }}>
          <Film size={22} className="text-black/25" />
        </div>
      )}
      <div className="flex items-center gap-3 px-3 pt-2">
        <Heart size={16} className="text-black" />
        <MessageCircle size={16} className="text-black" />
        <Send size={16} className="text-black" />
        <Bookmark size={16} className="ml-auto text-black" />
      </div>
      <p className="px-3 pt-1.5 text-[10px] font-semibold text-black">2.741 Me gusta</p>
      <p className="px-3 pt-0.5 text-[10px] text-black leading-snug line-clamp-2 whitespace-pre-wrap break-words">
        <span className="font-semibold">{user}</span> {text || "Tu caption aparecerá aquí..."}
      </p>
    </div>
  );
}

const PREVIEWS: Record<PublishPlatform, (props: Props) => React.ReactElement> = {
  tiktok: TikTokPreview,
  instagram: ReelsPreview,
  facebook: FacebookPreview,
  youtube: ShortsPreview,
  x: XPreview,
  linkedin: LinkedInPreview,
  threads: ThreadsPreview,
};

// Mockup de móvil con el aspecto real del post en cada red
export function PostPreview(props: Props) {
  const Inner =
    props.platform === "instagram" && props.mediaType === "image"
      ? InstagramPhotoPreview
      : PREVIEWS[props.platform];
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-[2rem] border-[7px] border-[#1a1a22] shadow-xl"
      style={{ width: 232, height: 464, backgroundColor: "#000" }}
    >
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#1a1a22] rounded-full z-10" />
      <Inner {...props} />
    </div>
  );
}
