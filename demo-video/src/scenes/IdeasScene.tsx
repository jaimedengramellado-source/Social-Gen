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
  Bookmark,
  ArrowRight,
} from "lucide-react";
import { BrowserCard } from "../components/BrowserCard";
import { TopNav } from "../components/TopNav";
import { ChatSidebar } from "../components/ChatSidebar";
import { Logo } from "../components/Logo";
import { fadeUp, typedText } from "../components/reveal";
import { colors } from "../theme";
import { fontFamilySans, fontFamilySerif } from "../fonts";

const USER_PROMPT = "Dame 5 ideas virales para mi nicho con hook fuerte.";

type Idea = {
  title: string;
  hook: string;
  whyViral: string;
  viralScore: number;
  hookType: string;
  contentStyle: string;
};

// Espejo del formato real de /crear: IdeaCards en chat-interface.tsx (título, hook,
// por qué funciona, puntuación viral, tipo de hook, estilo de contenido).
const IDEAS: Idea[] = [
  {
    title: "Probé el método de la Marina para levantarme a las 4am",
    hook: "Puse 7 alarmas y aún así casi lo dejo el día 2.",
    whyViral: "Reto extremo + resultado inesperado = alta retención",
    viralScore: 94,
    hookType: "Reto personal",
    contentStyle: "Storytime",
  },
  {
    title: "Cancelé todas mis suscripciones un mes. Esto pasó",
    hook: "Ahorré 340€... y descubrí algo que no esperaba.",
    whyViral: "Curiosidad + ahorro real invita a comentar",
    viralScore: 81,
    hookType: "Curiosidad",
    contentStyle: "Talking head",
  },
  {
    title: "3 hábitos de gente exitosa que en realidad no sirven",
    hook: "El tercero me sorprendió a mí también.",
    whyViral: "Contraste con lo esperado genera debate",
    viralScore: 63,
    hookType: "Contraste",
    contentStyle: "Lista rápida",
  },
];

const SUGGESTIONS = [
  { icon: Lightbulb, label: "Ideas virales" },
  { icon: FileText, label: "Escribir guion" },
  { icon: Anchor, label: "Analizar hook" },
  { icon: TrendingUp, label: "Estrategia" },
];

function scoreColor(score: number) {
  if (score >= 75) return { bg: "#d1fae5", text: "#065f46", ring: "#10b981" };
  if (score >= 50) return { bg: "#fef3c7", text: "#92400e", ring: "#f59e0b" };
  return { bg: "#fee2e2", text: "#991b1b", ring: "#ef4444" };
}

export const IdeasScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Fase 1: estado vacío
  const heroOpacity = interpolate(frame, [70, 86], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headingStyle = fadeUp(frame, 8, 14);
  const heroInputStyle = fadeUp(frame, 18, 14);
  const chipClickScale = interpolate(frame, [56, 60, 64], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chipActive = frame > 58;

  // Fase 2: conversación
  const convOpacity = interpolate(frame, [76, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const userBubbleStyle = fadeUp(frame, 88, 10);
  const userTyped = typedText(frame, 94, USER_PROMPT, 50);

  const aiMarkerStyle = fadeUp(frame, 150, 10);
  const loadingOpacity = interpolate(frame, [158, 170, 186, 198], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ideasLabelStyle = fadeUp(frame, 204, 12);
  const cardsStart = 218;
  const cardsStagger = 34;

  const inputBarStyle = fadeUp(frame, 100, 12);
  const sidebarActive = frame > 90;

  return (
    <BrowserCard url="socialflamingo.app/crear">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <TopNav active="crear" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <ChatSidebar active={sidebarActive} />

          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
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
              <div
                style={{
                  ...headingStyle,
                  fontFamily: fontFamilySerif,
                  fontSize: 34,
                  textAlign: "center",
                  color: colors.foreground,
                }}
              >
                ¿Cuál es la idea de hoy?
              </div>
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

              <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
                {SUGGESTIONS.map((s, i) => {
                  const chipStyle = fadeUp(frame, 32 + i * 6, 10);
                  const highlighted = i === 0 && chipActive;
                  return (
                    <div
                      key={s.label}
                      style={{
                        ...chipStyle,
                        transform: `${chipStyle.transform} scale(${i === 0 ? chipClickScale : 1})`,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: `1.5px solid ${highlighted ? colors.primary : colors.border}`,
                        borderRadius: 999,
                        padding: "7px 13px",
                        fontFamily: fontFamilySans,
                        fontSize: 12,
                        fontWeight: 500,
                        color: highlighted ? colors.primary : colors.foreground,
                        backgroundColor: highlighted ? colors.primaryLight : colors.card,
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
            <div style={{ position: "absolute", inset: 0, opacity: convOpacity, display: "flex", flexDirection: "column" }}>
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
                    {userTyped.typing && <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>}
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
                      Buscando ideas con mejor potencial viral...
                    </span>
                  </div>

                  <div
                    style={{
                      ...ideasLabelStyle,
                      fontFamily: fontFamilySans,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: colors.mutedForeground,
                    }}
                  >
                    Ideas generadas
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {IDEAS.map((idea, i) => {
                      const style = fadeUp(frame, cardsStart + i * cardsStagger, 14);
                      const { bg, text, ring } = scoreColor(idea.viralScore);
                      return (
                        <div
                          key={idea.title}
                          style={{
                            ...style,
                            backgroundColor: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 16,
                            padding: 14,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: fontFamilySans, fontWeight: 700, fontSize: 13, lineHeight: 1.35, color: colors.foreground }}>
                                {idea.title}
                              </div>
                              <div style={{ fontFamily: fontFamilySans, fontSize: 11.5, marginTop: 4, lineHeight: 1.4, color: colors.mutedForeground }}>
                                {idea.hook}
                              </div>
                              <div
                                style={{
                                  fontFamily: fontFamilySans,
                                  fontSize: 11,
                                  borderRadius: 10,
                                  padding: "6px 10px",
                                  marginTop: 8,
                                  lineHeight: 1.4,
                                  color: colors.primary,
                                  backgroundColor: colors.primaryLight,
                                }}
                              >
                                {idea.whyViral}
                              </div>
                            </div>
                            <div
                              style={{
                                flexShrink: 0,
                                width: 34,
                                height: 34,
                                borderRadius: 999,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: fontFamilySans,
                                fontWeight: 800,
                                fontSize: 12.5,
                                backgroundColor: bg,
                                color: text,
                                boxShadow: `0 0 0 2px ${ring}`,
                              }}
                            >
                              {idea.viralScore}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                            <div style={{ display: "flex", gap: 5 }}>
                              <Pill label={idea.hookType} tone="primary" />
                              <Pill label={idea.contentStyle} tone="muted" />
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <SmallOutlineButton icon={Bookmark} label="Guardar" />
                              <SmallSolidButton icon={ArrowRight} label="Crear guion" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                  <div style={{ flex: 1, fontFamily: fontFamilySans, fontSize: 12.5, color: colors.mutedForeground }}>
                    Dame ideas para un vídeo de...
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

const Pill: React.FC<{ label: string; tone: "primary" | "muted" }> = ({ label, tone }) => (
  <span
    style={{
      fontFamily: fontFamilySans,
      fontSize: 9.5,
      fontWeight: 600,
      borderRadius: 999,
      padding: "3px 8px",
      color: tone === "primary" ? colors.primary : colors.mutedForeground,
      backgroundColor: tone === "primary" ? colors.primaryLight : colors.muted,
    }}
  >
    {label}
  </span>
);

const SmallOutlineButton: React.FC<{ icon: typeof Bookmark; label: string }> = ({ icon: Icon, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: "5px 8px",
      fontFamily: fontFamilySans,
      fontSize: 10,
      fontWeight: 600,
      color: colors.mutedForeground,
    }}
  >
    <Icon size={11} />
    {label}
  </div>
);

const SmallSolidButton: React.FC<{ icon: typeof ArrowRight; label: string }> = ({ icon: Icon, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      borderRadius: 8,
      padding: "5px 9px",
      fontFamily: fontFamilySans,
      fontSize: 10,
      fontWeight: 700,
      color: "#fff",
      backgroundColor: colors.primary,
    }}
  >
    {label}
    <Icon size={11} />
  </div>
);

const Spinner: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ transform: `rotate(${frame * 10}deg)`, display: "flex", color: colors.primary }}>
    <Loader2 size={13} />
  </div>
);
