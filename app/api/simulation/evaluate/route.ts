import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL =
  process.env.FASTAPI_URL || "https://elevate-ai-flask.onrender.com";

function buildFallbackEvaluation(body: Record<string, unknown>) {
  const rawResponse =
    typeof body.user_response === "string"
      ? body.user_response
      : typeof body.response === "string"
        ? body.response
        : "";
  const wordCount = rawResponse.trim().split(/\s+/).filter(Boolean).length;
  const score = Math.max(40, Math.min(88, 45 + wordCount * 2));

  return {
    feedback:
      "Your response has been evaluated with the local fallback scorer because the AI evaluation service is temporarily unavailable. You identified a reasonable approach; improve the answer by adding architecture trade-offs, failure modes, operational metrics, and how you would validate the solution in production.",
    score,
    suggestions: [
      "Explain why you chose this approach over alternatives.",
      "Describe storage, scaling, and failure-mode handling.",
      "Add concrete metrics, tests, and rollout/monitoring steps.",
    ],
    next_prompt:
      "What is the biggest trade-off in your proposed design, and how would you monitor it after launch?",
    source: "fallback",
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();

    const response = await fetch(`${FASTAPI_URL}/api/simulation/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Evaluation failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error evaluating simulation:", error);
    return NextResponse.json(buildFallbackEvaluation(body ?? {}));
  }
}
