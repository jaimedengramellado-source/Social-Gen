import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL, SYSTEM_PROMPTS, fetchUserAIContext } from "@/lib/anthropic";
import { checkAndDeductCredits } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  const userContext = await fetchUserAIContext(supabase, user.id);
  const credit = await checkAndDeductCredits(user.id, "score_script");
  if (!credit.ok) {
    return NextResponse.json({ error: credit.error, creditsRemaining: credit.creditsRemaining }, { status: 402 });
  }

  const body = await request.json();
  const { script, platform, niche } = body;

  if (!script || script.trim().length < 50) {
    return NextResponse.json({ error: "SCRIPT_TOO_SHORT" }, { status: 400 });
  }

  const userPrompt = `Analiza y puntúa este guion:

Plataforma: ${platform || "No especificada"}
Nicho: ${niche || "No especificado"}

GUION:
${script}`;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: userContext + SYSTEM_PROMPTS.scoreScript,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const analysis = JSON.parse(extractJSON(raw));

    return NextResponse.json({ analysis, creditsRemaining: credit.creditsRemaining });
  } catch (err) {
    console.error("score-script error:", err);
    return NextResponse.json({ error: "AI_ERROR" }, { status: 500 });
  }
}
