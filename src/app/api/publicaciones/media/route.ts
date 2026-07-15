import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { mediaProxySignature } from "@/lib/publish-storage";

// Proxy público de medios del bucket publish-videos, con firma HMAC caducable.
// Existe porque las fotos de TikTok solo aceptan PULL_FROM_URL desde un dominio
// verificado en su developer portal: servimos la imagen bajo nuestro dominio en
// lugar de la URL firmada de supabase.co. La firma la genera signedMediaProxyUrl.

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";

  if (!path || path.includes("..") || !Number.isFinite(exp) || !sig) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 403 });
  }

  let expected: string;
  try {
    expected = mediaProxySignature(path, exp);
  } catch {
    // Sin secreto configurado el proxy queda cerrado (fail closed)
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.storage.from("publish-videos").download(path);
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return new Response(data.stream(), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(data.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
