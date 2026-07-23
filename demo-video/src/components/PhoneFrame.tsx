import React from "react";
import { colors } from "../theme";

export const PhoneFrame: React.FC<{
  width: number;
  dark?: boolean;
  children: React.ReactNode;
}> = ({ width, dark = false, children }) => {
  const height = width * (19.5 / 9);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.16,
        border: `${Math.max(3, width * 0.028)}px solid #17171B`,
        backgroundColor: dark ? "#000" : "#fff",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: width * 0.34,
          height: width * 0.075,
          backgroundColor: "#17171B",
          borderRadius: `0 0 ${width * 0.06}px ${width * 0.06}px`,
          zIndex: 5,
        }}
      />
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {children}
      </div>
    </div>
  );
};

export const phoneColors = colors;
