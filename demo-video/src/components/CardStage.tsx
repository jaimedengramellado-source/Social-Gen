import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { Logo } from "./Logo";
import { colors } from "../theme";
import { fontFamilySerif, fontFamilySans } from "../fonts";

const useEntrance = (duration = 16) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
  });
  return { opacity: p, transform: `translateY(${(1 - p) * 22}px)` };
};

export const CardStageVertical: React.FC<{
  headline: string;
  cardWidth: number;
  cardHeight: number;
  children: React.ReactNode;
}> = ({ headline, cardWidth, cardHeight, children }) => {
  const entrance = useEntrance();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        padding: "80px 64px",
      }}
    >
      <div
        style={{
          ...entrance,
          fontFamily: fontFamilySerif,
          fontSize: 56,
          lineHeight: 1.12,
          textAlign: "center",
          color: colors.foreground,
          maxWidth: 880,
        }}
      >
        {headline}
      </div>
      <div style={{ width: cardWidth, height: cardHeight, ...entrance }}>
        {children}
      </div>
      <Logo size={34} />
    </div>
  );
};

export const CardStageHorizontal: React.FC<{
  headline: string;
  subheadline: string;
  cardWidth: number;
  cardHeight: number;
  children: React.ReactNode;
}> = ({ headline, subheadline, cardWidth, cardHeight, children }) => {
  const entrance = useEntrance();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 96px",
        gap: 72,
      }}
    >
      <div style={{ width: 480, flexShrink: 0, ...entrance }}>
        <Logo size={30} />
        <div
          style={{
            marginTop: 26,
            fontFamily: fontFamilySerif,
            fontSize: 50,
            lineHeight: 1.14,
            color: colors.foreground,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: fontFamilySans,
            fontSize: 19,
            lineHeight: 1.5,
            color: colors.mutedForeground,
          }}
        >
          {subheadline}
        </div>
      </div>
      <div
        style={{
          width: cardWidth,
          height: cardHeight,
          flexShrink: 0,
          ...entrance,
        }}
      >
        {children}
      </div>
    </div>
  );
};
