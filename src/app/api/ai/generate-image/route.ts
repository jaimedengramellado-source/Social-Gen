import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getGeminiClient, IMAGEN_MODEL } from "@/lib/gemini";
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
  const { prompt, aspectRatio = "1:1", mode = "generate", parentImageId = null } = body;

  const actionKey = mode === "variation" ? "image_variation" : "generate_image";
  const credit = await checkAndDeductCredits(user.id, actionKey);
  if (!credit.ok) {
    return NextResponse.json(
      { error: credit.error, creditsRemaining: credit.creditsRemaining },
      { status: 402 }
    );
  }

  try {
    const model = getGeminiClient().getGenerativeModel({
      model: IMAGEN_MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] } as any,
    });

    const result = await model.generateContent([
      { text: prompt },
    ]);

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      console.error("Gemini image: no image in response");
      return NextResponse.json({ error: "NO_IMAGE_IN_RESPONSE" }, { status: 500 });
    }

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.png`;

    const adminSupabase = await createAdminClient();
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
        prompt,
        model_used: "imagen-3",
        image_url: signedData!.signedUrl,
        storage_path: storagePath,
        parent_image_id: parentImageId,
        aspect_ratio: aspectRatio,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ images: [dbRecord], creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("generate-image error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
