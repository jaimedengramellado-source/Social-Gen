import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { data: images, error } = await supabase
    .from("generated_images")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  // image_url se guarda como signed URL de larga duración en el momento de generar
  // la imagen; se regenera aquí para que no deje de funcionar si esa URL expira.
  const admin = await createAdminClient();
  const withFreshUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data: signed } = await admin.storage
        .from("generated-images")
        .createSignedUrl(img.storage_path, 60 * 60 * 24 * 365);
      return signed ? { ...img, image_url: signed.signedUrl } : img;
    })
  );

  return NextResponse.json({ images: withFreshUrls });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { imageId } = await request.json();

  const { data: record, error: fetchError } = await supabase
    .from("generated_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !record) {
    return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  const adminSupabase = await createAdminClient();
  await adminSupabase.storage.from("generated-images").remove([record.storage_path]);

  await adminSupabase.from("generated_images").delete().eq("id", imageId);

  return NextResponse.json({ ok: true });
}
