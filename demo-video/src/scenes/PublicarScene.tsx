import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import {
  Upload,
  CalendarDays,
  Zap,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Check,
  MoreHorizontal,
  Image as ImageIcon,
  AlertTriangle,
  X as XClose,
} from "lucide-react";
import { BrowserCard } from "../components/BrowserCard";
import { TopNav } from "../components/TopNav";
import { PhoneFrame } from "../components/PhoneFrame";
import { fadeUp, typedText, progress } from "../components/reveal";
import {
  TiktokIcon,
  InstagramIcon,
  FacebookIcon,
  XIcon,
  LinkedinIcon,
  YoutubeIcon,
} from "../components/BrandIcons";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

const CAPTION = "5 hábitos que cambiaron mis mañanas 🌅 #productividad #rutina";

const PLATFORMS = [
  { key: "youtube", label: "YouTube", Icon: YoutubeIcon, disabled: true },
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "tiktok", label: "TikTok", Icon: TiktokIcon },
  { key: "x", label: "X", Icon: XIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon },
];

export const PublicarScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headerStyle = fadeUp(frame, 4, 10);
  const cardStyle = fadeUp(frame, 12, 12);

  const igDone = progress(frame, 30, 8) >= 1;
  const tiktokDone = progress(frame, 44, 8) >= 1;

  const dropzoneOpacity = interpolate(frame, [58, 72], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fileRowOpacity = interpolate(frame, [66, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tabsStyle = fadeUp(frame, 86, 10);
  const captionTyped = typedText(frame, 96, CAPTION, 66);

  const previewStyle = fadeUp(frame, 140, 16);
  const igPreviewOpacity = interpolate(frame, [150, 162, 224, 238], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tiktokPreviewOpacity = interpolate(frame, [230, 244], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const previewLabel = frame < 236 ? "Así se verá en Instagram" : "Así se verá en TikTok";

  const scheduleStyle = fadeUp(frame, 262, 12);
  const ctaFadeIn = fadeUp(frame, 288, 12);
  const pressScale =
    frame > 306 && frame < 322
      ? 1 - Math.sin(((frame - 306) / 16) * Math.PI) * 0.06
      : 1;
  const ctaFadeOut = 1 - progress(frame, 314, 12);
  const ctaStyle = { ...ctaFadeIn, opacity: ctaFadeIn.opacity * ctaFadeOut };

  const toastP = progress(frame, 318, 18);
  const toastY = (1 - toastP) * 70;

  return (
    <BrowserCard url="socialflamingo.app/publicar">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <TopNav active="publicar" />

        <div style={{ flex: 1, position: "relative", overflow: "hidden", padding: "20px 26px" }}>
          <div style={{ ...headerStyle, marginBottom: 14 }}>
            <div style={{ fontFamily: fontFamilySans, fontWeight: 700, fontSize: 20, color: colors.foreground }}>
              Publicar
            </div>
            <div style={{ fontFamily: fontFamilySans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              Un mismo vídeo, todas tus redes: elige dónde publicarlo y prográmalo.
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              backgroundColor: colors.card,
              padding: 18,
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                fontFamily: fontFamilySans,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: colors.mutedForeground,
                marginBottom: 9,
              }}
            >
              Publicar en
            </div>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
              {PLATFORMS.map((p) => {
                const selected = (p.key === "instagram" && igDone) || (p.key === "tiktok" && tiktokDone);
                return (
                  <div
                    key={p.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 11px",
                      borderRadius: 999,
                      border: `1.3px solid ${selected ? colors.primary : colors.border}`,
                      backgroundColor: selected ? colors.accent : colors.card,
                      color: selected ? colors.accentForeground : p.disabled ? colors.mutedForeground : colors.foreground,
                      fontFamily: fontFamilySans,
                      fontSize: 11.5,
                      fontWeight: 600,
                      opacity: p.disabled ? 0.55 : 1,
                    }}
                  >
                    <p.Icon size={12} />
                    {p.label}
                    {p.disabled && (
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          backgroundColor: colors.muted,
                          borderRadius: 999,
                          padding: "1px 5px",
                        }}
                      >
                        PRONTO
                      </span>
                    )}
                    {selected && <Check size={11} />}
                  </div>
                );
              })}
            </div>

            <div style={{ position: "relative", height: 54, marginBottom: 14 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: dropzoneOpacity,
                  border: `1.5px dashed ${colors.border}`,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: fontFamilySans,
                  fontSize: 12,
                  color: colors.mutedForeground,
                }}
              >
                <Upload size={14} />
                Arrastra tu vídeo o foto aquí, o haz clic para elegirlo
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: fileRowOpacity,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  padding: "0 14px",
                }}
              >
                <ImageIcon size={16} color={colors.primary} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontFamilySans, fontWeight: 600, fontSize: 12.5, color: colors.foreground }}>
                    rutina-matutina.mp4
                  </div>
                  <div style={{ fontFamily: fontFamilySans, fontSize: 10.5, color: colors.mutedForeground }}>
                    24.6 MB
                  </div>
                </div>
                <XClose size={14} color={colors.mutedForeground} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ width: "56%" }}>
                <div style={{ ...tabsStyle, display: "flex", gap: 6, marginBottom: 10 }}>
                  <Tab label="Texto general" active />
                  <Tab label="Instagram" Icon={InstagramIcon} />
                  <Tab label="TikTok" Icon={TiktokIcon} />
                </div>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 12,
                    minHeight: 76,
                    fontFamily: fontFamilySans,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: colors.foreground,
                  }}
                >
                  {captionTyped.text}
                  {captionTyped.typing && <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>}
                </div>
                {igDone && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: colors.warning,
                      backgroundColor: colors.warningBg,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontFamily: fontFamilySans,
                      fontSize: 10.5,
                      fontWeight: 500,
                      opacity: interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                    }}
                  >
                    <AlertTriangle size={11} />
                    Las fotos no se publican en YouTube.
                  </div>
                )}
              </div>

              <div style={{ width: "44%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ ...previewStyle, width: 128, height: 128 * (19.5 / 9) }}>
                  <PhoneFrame width={128}>
                    <div style={{ position: "absolute", inset: 0, opacity: igPreviewOpacity, backgroundColor: "#fff" }}>
                      <InstagramPost />
                    </div>
                    <div style={{ position: "absolute", inset: 0, opacity: tiktokPreviewOpacity }}>
                      <TikTokPost />
                    </div>
                  </PhoneFrame>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: fontFamilySans,
                    fontSize: 10.5,
                    color: colors.mutedForeground,
                    opacity: previewStyle.opacity,
                  }}
                >
                  {previewLabel}
                </div>
              </div>
            </div>

            <div style={{ ...scheduleStyle, marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
              <div
                style={{
                  fontFamily: fontFamilySans,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: colors.mutedForeground,
                  marginBottom: 9,
                }}
              >
                Publicación
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <Tab label="Programar" active small />
                <Tab label="Publicar ahora" small />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fontFamilySans, fontSize: 11, color: colors.mutedForeground }}>
                  Mejores horas:
                </span>
                {["Dom 20:00", "Mar 22:00", "Mar 16:00"].map((h) => (
                  <div
                    key={h}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontFamily: fontFamilySans,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: colors.foreground,
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                ...ctaStyle,
                transform: `scale(${pressScale})`,
                marginTop: 16,
                backgroundColor: colors.primary,
                color: "#fff",
                borderRadius: 12,
                padding: "13px 0",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: fontFamilySans,
                fontWeight: 700,
                fontSize: 13.5,
              }}
            >
              <CalendarDays size={15} /> Programar en 2 redes
            </div>
          </div>

          {/* Toast de éxito */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              transform: `translateY(${toastY}px)`,
              opacity: toastP,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: colors.success,
              color: "#fff",
              padding: "18px 24px",
              fontFamily: fontFamilySans,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 -10px 28px rgba(5,150,105,0.28)",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Check size={12} />
            </div>
            ¡Programado en Instagram y TikTok!
          </div>
        </div>
      </div>
    </BrowserCard>
  );
};

const Tab: React.FC<{ label: string; Icon?: typeof Check; active?: boolean; small?: boolean }> = ({
  label,
  Icon,
  active,
  small,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: small ? "5px 11px" : "6px 12px",
      borderRadius: 999,
      backgroundColor: active ? colors.primary : "transparent",
      color: active ? "#fff" : colors.mutedForeground,
      fontFamily: fontFamilySans,
      fontSize: small ? 11 : 11.5,
      fontWeight: 600,
    }}
  >
    {Icon && <Icon size={11} />}
    {label}
  </div>
);

const InstagramPost: React.FC = () => (
  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", paddingTop: "16%" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "radial-gradient(circle at 30% 107%, #fdf497, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
        }}
      />
      <div style={{ fontFamily: fontFamilySans, fontWeight: 700, fontSize: 8, flex: 1 }}>socialflamingo</div>
      <MoreHorizontal size={11} />
    </div>
    <div style={{ width: "100%", flex: 1, background: "linear-gradient(150deg, #EFE1CB 0%, #F7DEE2 100%)" }} />
    <div style={{ padding: "5px 8px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <Heart size={11} />
        <MessageCircle size={11} />
        <Share2 size={10} />
        <div style={{ flex: 1 }} />
        <Bookmark size={11} />
      </div>
      <div style={{ fontFamily: fontFamilySans, fontWeight: 700, fontSize: 7.5 }}>2.741 Me gusta</div>
      <div style={{ fontFamily: fontFamilySans, fontSize: 7, lineHeight: 1.35, marginTop: 2 }}>
        <b>socialflamingo</b> 5 hábitos que cambiaron mis mañanas 🌅
      </div>
    </div>
  </div>
);

const TikTokPost: React.FC = () => (
  <div style={{ position: "relative", width: "100%", height: "100%", background: "linear-gradient(160deg, #2B2B33 0%, #17171B 100%)" }}>
    <div
      style={{
        position: "absolute",
        right: 6,
        bottom: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 9,
        color: "#fff",
      }}
    >
      <IconCount icon={Heart} count="12k" />
      <IconCount icon={Bookmark} count="3.2k" />
      <IconCount icon={Share2} count="8.5k" />
    </div>
    <div style={{ position: "absolute", left: 8, right: 30, bottom: 10, color: "#fff", fontFamily: fontFamilySans }}>
      <div style={{ fontWeight: 700, fontSize: 8, marginBottom: 3 }}>@socialflamingo</div>
      <div style={{ fontSize: 7, lineHeight: 1.3, opacity: 0.92 }}>
        5 hábitos que cambiaron mis mañanas 🌅 #productividad
      </div>
      <div style={{ fontSize: 6.5, opacity: 0.85, marginTop: 3 }}>♪ sonido original - socialflamingo</div>
    </div>
  </div>
);

const IconCount: React.FC<{ icon: typeof Heart; count: string }> = ({ icon: Icon, count }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
    <Icon size={14} fill="#fff" />
    <span style={{ fontFamily: fontFamilySans, fontSize: 6, fontWeight: 600 }}>{count}</span>
  </div>
);
