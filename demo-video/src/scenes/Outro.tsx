import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

export const Outro: React.FC<{ logoSize?: number }> = ({ logoSize = 64 }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 15], [14, 0], {
    extrapolateRight: "clamp",
  });
  const pillScale = interpolate(frame, [20, 34], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pillOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <Logo size={logoSize} />
        <div
          style={{
            fontFamily: fontFamilySans,
            fontSize: 21,
            fontWeight: 500,
            color: colors.mutedForeground,
            textAlign: "center",
          }}
        >
          Tu primer vídeo viral en segundos
        </div>
        <div
          style={{
            marginTop: 8,
            opacity: pillOpacity,
            transform: `scale(${pillScale})`,
            backgroundColor: colors.primary,
            color: "#FFFFFF",
            fontFamily: fontFamilySans,
            fontWeight: 600,
            fontSize: 18,
            padding: "12px 28px",
            borderRadius: 999,
          }}
        >
          socialflamingo.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
