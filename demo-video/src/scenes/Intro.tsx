import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Logo } from "../components/Logo";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

export const Intro: React.FC<{ logoSize?: number }> = ({ logoSize = 76 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 200 } });
  const logoOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [16, 28], [10, 0], {
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
          transform: `scale(${0.85 + logoScale * 0.15})`,
          opacity: logoOpacity,
        }}
      >
        <Logo size={logoSize} />
      </div>
      <div
        style={{
          marginTop: 22,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: fontFamilySans,
          fontSize: 22,
          fontWeight: 500,
          color: colors.mutedForeground,
          textAlign: "center",
        }}
      >
        La plataforma de los creadores de contenido virales
      </div>
    </AbsoluteFill>
  );
};
