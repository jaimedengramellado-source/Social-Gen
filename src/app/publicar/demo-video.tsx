"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function handlePlayClick() {
    setPlaying(true);
    videoRef.current?.play().catch(() => setPlaying(false));
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden border bg-black"
      style={{ borderColor: "var(--color-border)" }}
    >
      <video
        ref={videoRef}
        className="block w-full h-auto"
        poster="/videos/publicar-demo-poster.jpg"
        preload="none"
        controls={playing}
        playsInline
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        <source src="/videos/publicar-demo.mp4" type="video/mp4" />
      </video>

      {!playing && (
        <button
          type="button"
          onClick={handlePlayClick}
          className="group absolute inset-0 flex cursor-pointer items-center justify-center"
          aria-label="Reproducir vídeo de cómo publicar con Social Flamingo"
        >
          <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" />
          <span
            className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Play size={26} className="ml-1 text-white" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
