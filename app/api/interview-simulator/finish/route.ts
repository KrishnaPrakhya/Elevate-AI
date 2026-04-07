import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || "ollama";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:latest";

const client = new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl });

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildFallbackFeedback = (responses: Array<{ answer?: string }>, duration: number) => {
  const answeredCount = Array.isArray(responses)
    ? responses.filter((r) => (r.answer || "").trim().length > 0).length
    : 0;
  const totalCount = Array.isArray(responses) ? responses.length : 0;
  const completionRatio = totalCount > 0 ? answeredCount / totalCount : 0;
  const overall = Math.max(55, Math.min(95, Math.round(55 + completionRatio * 40)));

  return {
    overall,
    categories: {
      technical: Math.max(45, Math.min(95, overall - 3)),
      communication: Math.max(45, Math.min(95, overall + 2)),
      problemSolving: Math.max(45, Math.min(95, overall - 1)),
      confidence: Math.max(45, Math.min(95, overall + 1)),
    },
    strengths: [
      "Maintained a steady pace through the interview",
      "Showed willingness to think through problems",
      "Answered questions with clear intent",
    ],
    improvements: [
      "Add more measurable outcomes to each answer",
      "Use STAR structure for behavioral responses",
      "Summarize each answer with a clear result",
    ],
    summary: `You completed ${answeredCount}/${totalCount} questions in ${duration} minute(s). Focus on structuring answers with Situation, Action, and Result. Add measurable impact in each answer for stronger interviewer confidence.`,
  };
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { responses, mode, duration = 0 } = body;

    // Get user info for personalized feedback
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let feedbackData = buildFallbackFeedback(responses || [], duration);

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

Interview duration: ${duration} minutes
Responses: ${JSON.stringify(responses || [])}`;

    try {
      const result = await client.chat.completions.create({
        model: ollamaModel,
        messages: [
          {
            role: "system",
            content: "You are an expert interviewer providing concise performance feedback.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      });

      let content = result.choices[0]?.message?.content?.trim() || "";
      content = content.replace(/```json|```/g, "").trim();
      const parsed = safeJsonParse(content);

      if (parsed && typeof parsed === "object") {
        feedbackData = {
          overall: typeof parsed.overall === "number" ? parsed.overall : feedbackData.overall,
          categories: {
            technical:
              typeof parsed.categories?.technical === "number"
                ? parsed.categories.technical
                : feedbackData.categories.technical,
            communication:
              typeof parsed.categories?.communication === "number"
                ? parsed.categories.communication
                : feedbackData.categories.communication,
            problemSolving:
              typeof parsed.categories?.problemSolving === "number"
                ? parsed.categories.problemSolving
                : feedbackData.categories.problemSolving,
            confidence:
              typeof parsed.categories?.confidence === "number"
                ? parsed.categories.confidence
                : feedbackData.categories.confidence,
          },
          strengths: Array.isArray(parsed.strengths)
            ? parsed.strengths.filter((item: unknown) => typeof item === "string")
            : feedbackData.strengths,
          improvements: Array.isArray(parsed.improvements)
            ? parsed.improvements.filter((item: unknown) => typeof item === "string")
            : feedbackData.improvements,
          summary:
            typeof parsed.summary === "string" ? parsed.summary : feedbackData.summary,
        };
      }
    } catch (backendError) {
      console.warn("Ollama feedback unavailable, using fallback:", backendError);
    }

    // Save assessment to database
    await db.assessments.create({
      data: {
        userId: user.id,
        quizScore: feedbackData.overall || 75,
        questions: responses,
        category: "Interview Simulation",
        improvementTip: feedbackData.summary || "Continue practicing interview questions",
      },
    });

    return NextResponse.json({ feedback: feedbackData });
  } catch (error) {
    console.error("Error generating feedback:", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
