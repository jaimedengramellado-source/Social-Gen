import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { fontFamilySerif, fontFamilySans } from "../fonts";

// `type` en vez de `interface`: ver nota en HookCard.tsx.
export type ListCardProps = {
  title: string;
  items: string[];
  handle: string;
  durationInSeconds?: number;
};

export const ListCard: React.FC<ListCardProps> = ({ title, items, handle, durationInSeconds = 10 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const totalFrames = Math.round(durationInSeconds * fps);

  const blobAngle = frame * 0.6;
  const blobOffsetX = Math.sin((blobAngle * Math.PI) / 180) * 110;
  const blobOffsetY = Math.cos((blobAngle * Math.PI) / 180) * 80;
  const blobIn = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });

  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  const titleOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  // Los items se reparten entre el final del título y el 85% del vídeo, de modo
  // que la misma plantilla respira igual a 6, 10 o 15 segundos.
  const firstItemStart = 22;
  const lastItemStart = Math.max(firstItemStart + 8, Math.round(totalFrames * 0.85) - 14);
  const step = items.length > 1 ? (lastItemStart - firstItemStart) / (items.length - 1) : 0;

  const handleOpacity = interpolate(frame, [14, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: width * 0.85,
          height: width * 0.85,
          borderRadius: "50%",
          left: width * 0.6 + blobOffsetX - (width * 0.85) / 2,
          top: height * 0.18 + blobOffsetY - (width * 0.85) / 2,
          background: `radial-gradient(circle, ${colors.primaryLight} 0%, transparent 70%)`,
          opacity: 0.9 * blobIn,
          filter: "blur(2px)",
        }}
      />

      <AbsoluteFill style={{ padding: "180px 96px", justifyContent: "flex-start" }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${(1 - titleIn) * 24}px)`,
            fontFamily: fontFamilySerif,
            fontSize: 68,
            lineHeight: 1.12,
            color: colors.foreground,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>

        <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 44 }}>
          {items.map((item, i) => {
            const start = Math.round(firstItemStart + i * step);
            const inSpring = spring({
              frame: frame - start,
              fps,
              config: { damping: 200 },
              durationInFrames: 18,
            });
            const opacity = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 28,
                  opacity,
                  transform: `translateX(${(1 - inSpring) * 40}px)`,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: colors.primaryLight,
                    color: colors.primary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: fontFamilySans,
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    fontFamily: fontFamilySans,
                    fontSize: 40,
                    fontWeight: 500,
                    lineHeight: 1.3,
                    color: colors.foreground,
                    paddingTop: 6,
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {handle ? (
          <div
            style={{
              opacity: handleOpacity,
              fontFamily: fontFamilySans,
              fontSize: 22,
              fontWeight: 600,
              color: colors.primary,
            }}
          >
            {handle}
          </div>
        ) : null}
        <Logo size={30} />
      </div>
    </AbsoluteFill>
  );
};
