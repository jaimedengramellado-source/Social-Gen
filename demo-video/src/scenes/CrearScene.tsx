import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import {
  ArrowUp,
  Plus,
  ChevronDown,
  Lightbulb,
  FileText,
  Anchor,
  TrendingUp,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Save,
} from "lucide-react";
import { BrowserCard } from "../components/BrowserCard";
import { TopNav } from "../components/TopNav";
import { ChatSidebar } from "../components/ChatSidebar";
import { Logo } from "../components/Logo";
import { fadeUp, typedText } from "../components/reveal";
import { colors } from "../theme";
import { fontFamilySans, fontFamilySerif } from "../fonts";

const USER_PROMPT = "Dame un hook y guion corto para un reel de rutina matutina";

const HOOKS = [
  { label: "Hook 1", text: "“Me desperté a las 4:03 de la madrugada 30 días seguidos.”" },
  {
    label: "Hook 2",
    text: "“Copié la rutina matutina de un piloto de la Marina. El día 4 casi vomito.”",
    chosen: true,
  },
  { label: "Hook 3", text: "“Tu rutina matutina productiva te está haciendo menos productivo.”" },
];

const SUGGESTIONS = [
  { icon: Lightbulb, label: "Ideas virales" },
  { icon: FileText, label: "Escribir guion" },
  { icon: Anchor, label: "Analizar hook" },
  { icon: TrendingUp, label: "Estrategia" },
];

export const CrearScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Fase 1: estado vacío
  const heroOpacity = interpolate(frame, [72, 88], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headingStyle = fadeUp(frame, 8, 14);
  const heroInputStyle = fadeUp(frame, 18, 14);

  // Fase 2: conversación
  const convOpacity = interpolate(frame, [78, 94], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const userTyped = typedText(frame, 96, USER_PROMPT, 46);
  const userBubbleStyle = fadeUp(frame, 90, 10);

  const aiMarkerStyle = fadeUp(frame, 148, 10);
  const loadingOpacity = interpolate(frame, [156, 168, 184, 196], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hooksStart = 190;
  const hooksStagger = 16;

  const transitionLineStyle = fadeUp(frame, hooksStart + HOOKS.length * hooksStagger + 6, 12);
  const sectionStart = hooksStart + HOOKS.length * hooksStagger + 24;
  const headingBeatStyle = fadeUp(frame, sectionStart, 12);
  const dialogue1Style = fadeUp(frame, sectionStart + 12, 12);
  const visualCueStyle = fadeUp(frame, sectionStart + 26, 12);
  const dialogue2Style = fadeUp(frame, sectionStart + 40, 12);

  const exportStart = sectionStart + 58;
  const exportLineStyle = fadeUp(frame, exportStart, 12);
  const exportButtonsStyle = fadeUp(frame, exportStart + 10, 12);

  const inputBarStyle = fadeUp(frame, 100, 12);
  const sidebarActive = frame > 90;

  return (
    <BrowserCard url="socialflamingo.app/crear">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <TopNav active="crear" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <ChatSidebar active={sidebarActive} />

          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Estado vacío */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: heroOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 40px",
                pointerEvents: "none",
              }}
            >
              <HeroHeading style={headingStyle} />
              <div
                style={{
                  ...heroInputStyle,
                  width: "100%",
                  maxWidth: 520,
                  marginTop: 22,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 20,
                  backgroundColor: colors.card,
                  padding: 14,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    fontFamily: fontFamilySans,
                    fontSize: 13.5,
                    color: colors.mutedForeground,
                    padding: "2px 4px 12px",
                  }}
                >
                  Asigna una tarea o pregunta cualquier cosa
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconPill icon={Plus} />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontFamily: fontFamilySans,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: colors.foreground,
                    }}
                  >
                    Formato <ChevronDown size={11} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: colors.primaryLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowUp size={14} color={colors.primary} />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 18,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {SUGGESTIONS.map((s, i) => {
                  const chipStyle = fadeUp(frame, 32 + i * 6, 10);
                  return (
                    <div
                      key={s.label}
                      style={{
                        ...chipStyle,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 999,
                        padding: "7px 13px",
                        fontFamily: fontFamilySans,
                        fontSize: 12,
                        fontWeight: 500,
                        color: colors.foreground,
                        backgroundColor: colors.card,
                      }}
                    >
                      <s.icon size={12.5} color={colors.primary} />
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversación */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: convOpacity,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  padding: "22px 28px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      ...userBubbleStyle,
                      backgroundColor: colors.primary,
                      color: "#fff",
                      borderRadius: "16px 16px 4px 16px",
                      padding: "11px 15px",
                      maxWidth: "78%",
                      fontFamily: fontFamilySans,
                      fontSize: 13.5,
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {userTyped.text}
                    {userTyped.typing && (
                      <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>
                    )}
                  </div>
                </div>

                <div style={{ ...aiMarkerStyle, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      padding: "3px 9px",
                      width: "fit-content",
                    }}
                  >
                    <div style={{ transform: "scale(0.42)", transformOrigin: "left center" }}>
                      <Logo size={26} />
                    </div>
                  </div>

                  <div style={{ opacity: loadingOpacity, display: "flex", alignItems: "center", gap: 7 }}>
                    <Spinner frame={frame} />
                    <span style={{ fontFamily: fontFamilySans, fontSize: 12.5, color: colors.mutedForeground }}>
                      Analizando el contexto...
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {HOOKS.map((hook, i) => {
                      const style = fadeUp(frame, hooksStart + i * hooksStagger, 12);
                      return (
                        <div
                          key={hook.label}
                          style={{
                            ...style,
                            border: `1.5px solid ${colors.primary}`,
                            borderRadius: 12,
                            padding: "9px 12px",
                            fontFamily: fontFamilySans,
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: colors.foreground,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{hook.label}:</span> {hook.text}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      ...transitionLineStyle,
                      fontFamily: fontFamilySans,
                      fontSize: 12.5,
                      color: colors.foreground,
                    }}
                  >
                    Uso el hook 2 para el guion completo:
                  </div>

                  <div
                    style={{
                      ...headingBeatStyle,
                      fontFamily: fontFamilySans,
                      fontWeight: 700,
                      fontSize: 16,
                      color: colors.foreground,
                    }}
                  >
                    Hook (0-3s)
                  </div>

                  <div
                    style={{
                      ...dialogue1Style,
                      fontFamily: fontFamilySans,
                      fontStyle: "italic",
                      fontSize: 13,
                      color: colors.foreground,
                    }}
                  >
                    “Copié la rutina matutina de un piloto de la Marina durante una
                    semana.”
                  </div>

                  <div
                    style={{
                      ...visualCueStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: colors.bgInfo,
                      color: colors.textInfo,
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontFamily: fontFamilySans,
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    <ImageIcon size={13} />
                    plano cenital, el creador tumbado en la cama, luz azul de
                    madrugada
                  </div>

                  <div
                    style={{
                      ...dialogue2Style,
                      fontFamily: fontFamilySans,
                      fontStyle: "italic",
                      fontSize: 13,
                      color: colors.foreground,
                    }}
                  >
                    “Y el día 4... casi vomito.”
                  </div>

                  <div style={{ ...exportLineStyle, display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <Save size={13} color={colors.primary} />
                    <span style={{ fontFamily: fontFamilySans, fontSize: 11.5, color: colors.mutedForeground }}>
                      Puedes exportar este guion a Documentos.
                    </span>
                  </div>

                  <div style={{ ...exportButtonsStyle, display: "flex", gap: 8 }}>
                    <OutlineButton icon={ExternalLink} label="Exportar a Documentos" />
                    <OutlineButton icon={Eye} label="Vista previa" />
                  </div>
                </div>
              </div>

              <div style={{ padding: "0 28px 20px" }}>
                <div
                  style={{
                    ...inputBarStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 999,
                    padding: "10px 10px 10px 16px",
                    backgroundColor: colors.card,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                  }}
                >
                  <IconPill icon={Plus} small />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: "4px 9px",
                      fontFamily: fontFamilySans,
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}
                  >
                    Formato <ChevronDown size={10} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontFamily: fontFamilySans,
                      fontSize: 12.5,
                      color: colors.mutedForeground,
                    }}
                  >
                    Necesito un guion para...
                  </div>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      backgroundColor: colors.primaryLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ArrowUp size={13} color={colors.primary} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrowserCard>
  );
};

const HeroHeading: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      ...style,
      fontFamily: fontFamilySerif,
      fontSize: 34,
      textAlign: "center",
      color: colors.foreground,
    }}
  >
    ¿En qué te ayudo hoy?
  </div>
);

const IconPill: React.FC<{ icon: typeof Plus; small?: boolean }> = ({ icon: Icon, small }) => (
  <div
    style={{
      width: small ? 26 : 30,
      height: small ? 26 : 30,
      borderRadius: 999,
      border: `1px solid ${colors.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: colors.mutedForeground,
      flexShrink: 0,
    }}
  >
    <Icon size={small ? 12 : 13} />
  </div>
);

const OutlineButton: React.FC<{ icon: typeof Eye; label: string }> = ({ icon: Icon, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: `1px solid ${colors.border}`,
      borderRadius: 999,
      padding: "6px 12px",
      fontFamily: fontFamilySans,
      fontSize: 11,
      fontWeight: 600,
      color: colors.foreground,
    }}
  >
    <Icon size={12} />
    {label}
  </div>
);

const Spinner: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ transform: `rotate(${frame * 10}deg)`, display: "flex", color: colors.primary }}>
    <Loader2 size={13} />
  </div>
);
