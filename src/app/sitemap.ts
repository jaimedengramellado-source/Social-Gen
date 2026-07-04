import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/login`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
