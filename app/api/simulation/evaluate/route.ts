import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInternalBackendHeaders, getPythonBackendUrl } from "@/lib/python-backend";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();

    const response = await fetch(`${getPythonBackendUrl()}/api/simulation/evaluate`, {
      method: "POST",
      headers: getInternalBackendHeaders({ "Content-Type": "application/json" }),
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
