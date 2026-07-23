import React from "react";
import { fontFamilySerif } from "../fonts";
import { colors } from "../theme";

export const Logo: React.FC<{ size?: number }> = ({ size = 64 }) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "0.05em",
        fontSize: size,
        fontFamily: fontFamilySerif,
        fontWeight: 400,
        lineHeight: 1,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: colors.foreground }}>Social</span>
      <span
        style={{
          color: colors.primary,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
        }}
      >
        Flamingo
      </span>
    </div>
  );
};
