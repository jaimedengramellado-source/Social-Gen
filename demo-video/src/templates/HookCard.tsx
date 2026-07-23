import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { fontFamilySerif, fontFamilySans } from "../fonts";

// `type` en vez de `interface`: los interfaces no satisfacen el constraint
// Record<string, unknown> de <Composition>, y la inferencia de props se rompe.
export type HookCardProps = {
  hook: string;
  handle: string;
  durationInSeconds?: number;
};

export const HookCard: React.FC<HookCardProps> = ({ hook, handle }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const blobX = interpolate(frame, [0, 300], [0, 1], { extrapolateRight: "clamp" });
  const blobAngle = frame * 0.8;
  const blobOffsetX = Math.sin((blobAngle * Math.PI) / 180) * 120;
  const blobOffsetY = Math.cos((blobAngle * Math.PI) / 180) * 90;

  const textIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const textOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const handleOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const words = hook.split(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: width * 0.9,
          height: width * 0.9,
          borderRadius: "50%",
          left: width * 0.55 + blobOffsetX - (width * 0.9) / 2,
          top: height * 0.25 + blobOffsetY - (width * 0.9) / 2,
          background: `radial-gradient(circle, ${colors.primaryLight} 0%, transparent 70%)`,
          opacity: 0.9 * blobX,
          filter: "blur(2px)",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 90 }}>
        <div
          style={{
            opacity: textOpacity,
            transform: `scale(${0.92 + textIn * 0.08})`,
            fontFamily: fontFamilySerif,
            fontSize: 62,
            lineHeight: 1.18,
            textAlign: "center",
            color: colors.foreground,
          }}
        >
          {words.map((word, i) => {
            const start = 6 + i * 2;
            const o = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [start, start + 10], [10, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: o,
                  transform: `translateY(${y}px)`,
                  marginRight: "0.28em",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {handle ? (
          <div
            style={{
              marginTop: 34,
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
      </AbsoluteFill>

      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Logo size={30} />
      </div>
    </AbsoluteFill>
  );
};
