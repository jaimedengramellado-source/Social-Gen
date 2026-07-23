import React from "react";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

export const BrowserCard: React.FC<{
  url: string;
  children: React.ReactNode;
}> = ({ url, children }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 28,
        backgroundColor: colors.card,
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 14,
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: "#FCFBF9",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {["#EC6A5E", "#F5BF4F", "#61C454"].map((c) => (
            <div
              key={c}
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                backgroundColor: c,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: fontFamilySans,
              fontSize: 13,
              color: colors.mutedForeground,
              backgroundColor: colors.muted,
              borderRadius: 999,
              padding: "5px 20px",
            }}
          >
            {url}
          </div>
        </div>
        <div style={{ width: 47 }} />
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};
