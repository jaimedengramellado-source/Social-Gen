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
    maskBase64,
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

    const RATIO_HINT: Record<string, string> = {
      "16:9": "Output in widescreen horizontal format (16:9 aspect ratio, landscape).",
      "9:16": "Output in vertical portrait format (9:16 aspect ratio, tall).",
      "4:3": "Output in standard horizontal format (4:3 aspect ratio).",
      "1:1": "Output in square format (1:1 aspect ratio).",
    };
    const ratioHint = RATIO_HINT[aspectRatio] ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = maskBase64
      ? [
          { inlineData: { mimeType: mimeType, data: base64Image } },
          { inlineData: { mimeType: "image/png", data: maskBase64 } },
          {
            text: `Edit ONLY the region marked with WHITE pixels in the mask (second image). Do NOT modify anything outside that region. Keep everything else exactly as it is. Apply this change to the white region: ${editPrompt}`,
          },
        ]
      : [
          { inlineData: { mimeType: mimeType, data: base64Image } },
          { text: `${editPrompt} ${ratioHint}`.trim() },
        ];

    let result;
    try {
      result = await model.generateContent(contents);
    } catch (geminiErr) {
      console.error("edit-image gemini error:", geminiErr);
      return NextResponse.json({ error: "AI_ERROR", detail: String(geminiErr) }, { status: 500 });
    }

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      const responseText = parts.find((p: any) => p.text)?.text ?? "";
      console.error("edit-image: no image in response. Text:", responseText, "Candidates:", JSON.stringify(result.response.candidates?.map(c => c.finishReason)));
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
