import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getGeminiClient, GEMINI_EDIT_MODEL } from "@/lib/gemini";
import { checkAndDeductCredits } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const body = await request.json();
  const {
    editPrompt,
    sourceImageId,
    sourceImageBase64,
    sourceMimeType = "image/jpeg",
    aspectRatio = "1:1",
  } = body;

  const credit = await checkAndDeductCredits(user.id, "edit_image");
  if (!credit.ok) {
    return NextResponse.json(
      { error: credit.error, creditsRemaining: credit.creditsRemaining },
      { status: 402 }
    );
  }

  try {
    let base64Image: string;
    let mimeType: string;
    let parentImageId: string | null = null;

    const adminSupabase = await createAdminClient();

    if (sourceImageBase64) {
      base64Image = sourceImageBase64;
      mimeType = sourceMimeType;
    } else {
      const { data: sourceRecord, error: sourceError } = await supabase
        .from("generated_images")
        .select("storage_path")
        .eq("id", sourceImageId)
        .eq("user_id", user.id)
        .single();

      if (sourceError || !sourceRecord) {
        return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });
      }

      const { data: fileData, error: downloadError } = await adminSupabase.storage
        .from("generated-images")
        .download(sourceRecord.storage_path);

      if (downloadError || !fileData) throw downloadError ?? new Error("Download failed");

      base64Image = Buffer.from(await fileData.arrayBuffer()).toString("base64");
      mimeType = "image/png";
      parentImageId = sourceImageId;
    }

    const model = getGeminiClient().getGenerativeModel({
      model: GEMINI_EDIT_MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] } as any,
    });

    const result = await model.generateContent([
      { inlineData: { mimeType: mimeType, data: base64Image } },
      { text: editPrompt },
    ]);

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: "NO_IMAGE_IN_RESPONSE" }, { status: 500 });
    }

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: uploadError } = await adminSupabase.storage
      .from("generated-images")
      .upload(storagePath, buffer, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: signedData } = await adminSupabase.storage
      .from("generated-images")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const { data: dbRecord, error: dbError } = await adminSupabase
      .from("generated_images")
      .insert({
        user_id: user.id,
        prompt: editPrompt,
        model_used: "gemini-2.0-flash",
        image_url: signedData!.signedUrl,
        storage_path: storagePath,
        parent_image_id: parentImageId,
        aspect_ratio: aspectRatio,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ image: dbRecord, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("edit-image error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
