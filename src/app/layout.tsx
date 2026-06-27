import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
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
  title: {
    default: "Social Gen — Guiones virales con IA",
    template: "%s | Social Gen",
  },
  description:
    "Genera guiones e ideas virales para YouTube, TikTok e Instagram con IA. Optimizado para el algoritmo.",
  openGraph: {
    title: "Social Gen — Guiones virales con IA",
    description:
      "La herramienta definitiva para creadores de contenido. Genera guiones e ideas virales en segundos.",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Gen — Guiones virales con IA",
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
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark'){var r=document.documentElement;var d={"--color-background":"#0F0F13","--color-foreground":"#F0EFE9","--color-card":"#1A1A22","--color-card-foreground":"#F0EFE9","--color-popover":"#1A1A22","--color-popover-foreground":"#F0EFE9","--color-muted":"#1E1E28","--color-muted-foreground":"#8A8A9A","--color-border":"#2A2A38","--color-input":"#2A2A38","--color-secondary":"#1E1E28","--color-secondary-foreground":"#F0EFE9","--color-primary-light":"#2D1B69","--color-accent":"#2D1B69","--color-accent-foreground":"#A78BFA"};for(var k in d)r.style.setProperty(k,d[k]);r.classList.add('dark')}}catch(e){}` }} />
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
