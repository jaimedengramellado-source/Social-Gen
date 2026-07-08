import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Social Flamingo | Viralidad en un click",
    template: "%s | Social Flamingo",
  },
  description:
    "Genera guiones e ideas virales para YouTube, TikTok e Instagram con IA. Optimizado para el algoritmo.",
  openGraph: {
    title: "Social Flamingo | Viralidad en un click",
    description:
      "La herramienta definitiva para creadores de contenido. Genera guiones e ideas virales en segundos.",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Flamingo | Viralidad en un click",
    description: "Genera guiones e ideas virales para YouTube, TikTok e Instagram.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${instrumentSerif.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css" />
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark'){var r=document.documentElement;var d={"--color-background":"#0F0F13","--color-foreground":"#F0EFE9","--color-card":"#1A1A22","--color-card-foreground":"#F0EFE9","--color-popover":"#1A1A22","--color-popover-foreground":"#F0EFE9","--color-muted":"#1E1E28","--color-muted-foreground":"#8A8A9A","--color-border":"#2A2A38","--color-input":"#2A2A38","--color-secondary":"#1E1E28","--color-secondary-foreground":"#F0EFE9","--color-primary-light":"#43191F","--color-accent":"#43191F","--color-accent-foreground":"#D77582","--surface-1":"#0F0F13","--surface-2":"#1A1A22","--text-primary":"#F0EFE9","--text-secondary":"#C0BFB8","--text-muted":"#8A8A9A","--bg-pro":"#43191F","--bg-success":"#064E3B","--bg-accent":"#43191F","--text-pro":"#D77582","--text-success":"#34D399","--text-accent":"#D77582","--on-primary":"#FFFFFF","--fill-primary":"#8C2230","--border":"#2A2A38","--border-strong":"#3D3D4F","--cal-line-main":"rgba(255,255,255,0.07)","--cal-line-dashed":"rgba(255,255,255,0.04)","--cal-weekend-tint":"rgba(255,255,255,0.025)","--destructive-muted":"rgba(220,38,38,0.15)","--destructive-muted-border":"rgba(220,38,38,0.30)"};for(var k in d)r.style.setProperty(k,d[k]);r.classList.add('dark')}}catch(e){}` }} />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          backgroundColor: "var(--color-background)",
          color: "var(--color-foreground)",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
