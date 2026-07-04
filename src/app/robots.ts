import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/crear",
          "/ajustes",
          "/biblioteca",
          "/documentos",
          "/imagenes",
          "/estadisticas",
          "/calendario",
          "/todos",
          "/explorar",
          "/onboarding",
          "/share/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
