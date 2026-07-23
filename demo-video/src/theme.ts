export const colors = {
  background: "#F8F7F4",
  foreground: "#0D0D0D",
  card: "#FFFFFF",
  primary: "#8C2230",
  primaryHover: "#731C27",
  primaryLight: "#EFE1CB",
  secondary: "#F4F4F5",
  muted: "#F4F4F5",
  mutedForeground: "#6B6B6B",
  navForeground: "#4A4A4A",
  accent: "#EFE1CB",
  accentForeground: "#8C2230",
  success: "#059669",
  warning: "#D97706",
  warningBg: "#FEF3E2",
  border: "#E5E5E5",
  bgInfo: "#DBEAFE",
  textInfo: "#2563EB",
};

export const FPS = 30;

// Duración de cada bloque, en frames @30fps
export const durations = {
  intro: 55,
  crear: 345,
  publicar: 345,
  outro: 90,
  ideas: 390,
};

export const totalFrames =
  durations.intro + durations.crear + durations.publicar + durations.outro;

export const totalIdeasFrames = durations.intro + durations.ideas + durations.outro;
