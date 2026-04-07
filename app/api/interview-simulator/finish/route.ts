import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { recordExecutedAction } from "@/lib/performance/intelligence";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud";

const client = ollamaApiKey
  ? new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl })
  : null;

type InterviewResponse = {
  questionId?: string;
  answer?: string;
  duration?: number;
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractJsonObject = (value: string) => {
  const cleaned = value.replace(/```json|```/g, "").trim();
  const direct = safeJsonParse(cleaned);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const startIndex = cleaned.indexOf("{");
  const endIndex = cleaned.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const extracted = cleaned.slice(startIndex, endIndex + 1);
  const parsed = safeJsonParse(extracted);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
};

const clampScore = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const toText = (value: unknown) => (typeof value === "string" ? value : "");

const getScore = (value: unknown, fallback: number) =>
  typeof value === "number" ? clampScore(value) : fallback;

const buildFallbackFeedback = (responses: InterviewResponse[], durationMinutes: number) => {
  const answeredCount = Array.isArray(responses)
    ? responses.filter((r) => (r.answer || "").trim().length > 0).length
    : 0;
  const totalCount = Array.isArray(responses) ? responses.length : 0;
  const completionRatio = totalCount > 0 ? answeredCount / totalCount : 0;

  const allAnswers = responses
    .map((response) => (response.answer || "").trim())
    .filter((answer) => answer.length > 0);
  const avgWordCount =
    allAnswers.length > 0
      ? allAnswers
          .map((answer) => answer.split(/\s+/).filter(Boolean).length)
          .reduce((sum, count) => sum + count, 0) / allAnswers.length
      : 0;
  const depthRatio = Math.min(1, avgWordCount / 80);

  const overall = clampScore(50 + completionRatio * 28 + depthRatio * 20, 45, 94);

  return {
    overall,
    categories: {
      technical: clampScore(overall - 2, 42, 95),
      communication: clampScore(overall + 2, 42, 95),
      problemSolving: clampScore(overall - 1, 42, 95),
      confidence: clampScore(overall + 1, 42, 95),
    },
    strengths: [
      "Maintained a steady pace and answered consistently",
      "Demonstrated practical reasoning during problem solving",
      "Communicated ideas with clear intent",
    ],
    improvements: [
      "Use STAR structure more explicitly in behavioral examples",
      "Add measurable outcomes and technical trade-offs",
      "Close each answer with a concise business impact statement",
    ],
    summary: `You completed ${answeredCount}/${totalCount} questions in ${durationMinutes} minute(s). Your responses show solid momentum; to improve further, add concrete metrics and articulate trade-offs clearly. Structure each answer with context, action, and outcome for stronger interview impact.`,
  };
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { responses, mode, duration = 0, durationSeconds = 0 } = body;
    const responseList: InterviewResponse[] = Array.isArray(responses) ? responses : [];
    const safeDurationMinutes = Math.max(
      1,
      Number(durationSeconds) > 0
        ? Math.round(Number(durationSeconds) / 60)
        : Number(duration) || 1
    );

    // Get user info for personalized feedback
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let feedbackData = buildFallbackFeedback(responseList, safeDurationMinutes);

    const prompt = `Analyze the following interview responses and return ONLY valid JSON with this schema:
{
  "overall": number (0-100),
  "categories": {
    "technical": number (0-100),
    "communication": number (0-100),
    "problemSolving": number (0-100),
    "confidence": number (0-100)
  },
  "strengths": string[] (3-5 items),
  "improvements": string[] (3-5 items),
  "summary": string (3-5 sentences)
}
Use a professional, encouraging tone. Avoid markdown.

Scoring guidance:
- High scores require specific examples, technical reasoning, and measurable impact.
- Mid scores should indicate incomplete structure or limited depth.
- Low scores should indicate missing clarity or weak relevance.

Interview mode: ${mode || "unknown"}
Interview duration: ${safeDurationMinutes} minutes
Responses: ${JSON.stringify(responseList)}`;

    if (client) {
      try {
        const result = await client.chat.completions.create({
          model: ollamaModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert interviewer providing concise, evidence-based performance feedback. Return only JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        });

        const content = result.choices[0]?.message?.content?.trim() || "";
        const parsed = extractJsonObject(content);

        if (parsed) {
          const parsedCategories =
            parsed.categories && typeof parsed.categories === "object"
              ? (parsed.categories as Record<string, unknown>)
              : {};

          feedbackData = {
            overall: getScore(parsed.overall, feedbackData.overall),
            categories: {
              technical: getScore(parsedCategories.technical, feedbackData.categories.technical),
              communication: getScore(parsedCategories.communication, feedbackData.categories.communication),
              problemSolving: getScore(parsedCategories.problemSolving, feedbackData.categories.problemSolving),
              confidence: getScore(parsedCategories.confidence, feedbackData.categories.confidence),
            },
            strengths: Array.isArray(parsed.strengths)
              ? parsed.strengths.filter((item) => typeof item === "string")
              : feedbackData.strengths,
            improvements: Array.isArray(parsed.improvements)
              ? parsed.improvements.filter((item) => typeof item === "string")
              : feedbackData.improvements,
            summary: toText(parsed.summary) || feedbackData.summary,
          };
        }
      } catch (backendError) {
        console.warn("Ollama Cloud feedback unavailable, using fallback:", backendError);
      }
    }

    // Save assessment to database
    await db.assessments.create({
      data: {
        userId: user.id,
        quizScore: feedbackData.overall || 75,
        questions: responseList,
        category: "Interview Simulation",
        improvementTip: feedbackData.summary || "Continue practicing interview questions",
      },
    });

    await recordExecutedAction({
      userId: user.id,
      type: "UPDATE_PROGRESS",
      title: "Voice mock interview completed",
      description:
        "Interview simulation finished and feedback was generated from your recent responses.",
      params: {
        mode,
        responseCount: responseList.length,
        durationMinutes: safeDurationMinutes,
      },
      result: {
        overall: feedbackData.overall,
        categories: feedbackData.categories,
      },
      metadata: {
        source: "interview-simulator",
        reason:
          "This result updates interview-readiness trends and drives next interview/quiz recommendations.",
      },
    });

    return NextResponse.json({ feedback: feedbackData, source: client ? "ollama-cloud" : "fallback" });
  } catch (error) {
    console.error("Error generating feedback:", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
