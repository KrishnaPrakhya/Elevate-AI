import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud";

const model = ollamaApiKey
  ? new OpenAI({
      apiKey: ollamaApiKey,
      baseURL: ollamaBaseUrl,
    })
  : null;

const toExperienceLevel = (experience?: number | null) => {
  if (typeof experience !== "number") return "Mid-Level";
  if (experience <= 0) return "Intern";
  if (experience < 2) return "Junior";
  if (experience < 5) return "Mid-Level";
  if (experience < 8) return "Senior";
  if (experience < 12) return "Staff";
  return "Principal";
};

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

const toText = (value: unknown) => (typeof value === "string" ? value : "");

const buildFallbackInterviewerReply = (previousAnswer: string) => {
  const trimmed = previousAnswer.trim();
  if (!trimmed || trimmed === "[Skipped by candidate]") {
    return "No problem. Let us move to the next question.";
  }

  if (trimmed.length > 220) {
    return "Great depth in that answer. I appreciate the detail and structure.";
  }

  if (trimmed.length > 90) {
    return "Good response. You covered the key points clearly.";
  }

  return "Thanks. Try adding a concrete example and measurable impact in your next answer.";
};

const buildFallbackQuestion = (
  role: string,
  level: string,
  questionIndex: number,
  previousAnswer: string
) => {
  const templates = [
    `Walk me through a project where you made a measurable impact as a ${role}.`,
    "Tell me about a difficult debugging situation and how you resolved it.",
    "How do you make design trade-offs when speed and quality are both important?",
    "Describe a time you disagreed with a teammate and how you handled it.",
    "If you joined tomorrow, what would your first 30 days look like?",
  ];

  const inferredDifficulty: "easy" | "medium" | "hard" =
    previousAnswer.trim().length > 220
      ? "hard"
      : previousAnswer.trim().length > 100
      ? "medium"
      : "easy";

  return {
    id: `q-${Date.now()}-${questionIndex}`,
    question: templates[questionIndex % templates.length],
    category: "behavioral",
    difficulty: inferredDifficulty,
    expectedDuration: level.toLowerCase().includes("senior") ? 150 : 120,
    followUps: [],
  };
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { questionIndex, previousAnswer, role, level, responses = [] } = body;
    const safeQuestionIndex = Math.max(0, Number(questionIndex) || 0);
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { targetRole: true, experience: true },
    });
    const safeRole =
      typeof role === "string" && role.trim().length > 0
        ? role.trim()
        : user?.targetRole?.trim() || "Software Engineer";
    const safeLevel =
      typeof level === "string" && level.trim().length > 0
        ? level.trim()
        : toExperienceLevel(user?.experience);
    const safePreviousAnswer = typeof previousAnswer === "string" ? previousAnswer : "";
    const responseHistory: InterviewResponse[] = Array.isArray(responses) ? responses : [];
    const compactHistory = responseHistory
      .slice(-3)
      .map((response, index) => {
        const answer = toText(response.answer).replace(/\s+/g, " ").trim();
        return `Recent answer ${index + 1}: ${answer.slice(0, 280) || "[No answer provided]"}`;
      })
      .join("\n");

    if (!model) {
      return NextResponse.json({
        question: buildFallbackQuestion(safeRole, safeLevel, safeQuestionIndex, safePreviousAnswer),
        interviewerReply: buildFallbackInterviewerReply(safePreviousAnswer),
        source: "fallback-no-cloud-key",
      });
    }

    // Generate adaptive spoken interviewer reply and the next question
    const prompt = `Based on the previous answer, generate:
1) A brief interviewer spoken reply (1-2 short sentences)
2) The next adaptive interview question

Role: ${safeRole}
Level: ${safeLevel}
Previous answer: "${safePreviousAnswer}"
Question number: ${safeQuestionIndex + 1}

Recent response context:
${compactHistory || "No previous response history"}

If the previous answer was strong, make the next question slightly harder.
If the previous answer was weak, make it slightly easier or provide a follow-up.
Avoid asking a duplicate of the previous questions.
The interviewer reply should sound natural in voice conversation.

Return ONLY a JSON object in this format (no markdown):
{
  "interviewerReply": "Brief spoken acknowledgment and coaching",
  "question": {
    "id": "q-id",
    "question": "The actual question text",
    "category": "behavioral | technical | problem-solving | system-design | communication",
    "difficulty": "easy | medium | hard",
    "expectedDuration": 120,
    "followUps": ["Optional follow-up 1", "Optional follow-up 2"]
  }
}

Expected duration should be 60-180 seconds.`;

    try {
      const result = await model.chat.completions.create({
        model: ollamaModel,
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON generator for adaptive interview questions. Return only JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.55,
      });

      const questionText = result.choices[0]?.message?.content?.trim() || "";
      const question = extractJsonObject(questionText);
      if (!question) {
        return NextResponse.json({
          question: buildFallbackQuestion(safeRole, safeLevel, safeQuestionIndex, safePreviousAnswer),
          interviewerReply: buildFallbackInterviewerReply(safePreviousAnswer),
          source: "fallback-invalid-model-output",
        });
      }

      const questionObject =
        question.question && typeof question.question === "object" && !Array.isArray(question.question)
          ? (question.question as Record<string, unknown>)
          : question;

      // Sanitize
      const difficulty = ["easy", "medium", "hard"].includes(toText(questionObject.difficulty))
        ? (toText(questionObject.difficulty) as "easy" | "medium" | "hard")
        : "medium";

      const expectedDuration =
        typeof questionObject.expectedDuration === "number"
          ? Math.min(180, Math.max(60, questionObject.expectedDuration))
          : 120;

      const sanitizedQuestion = {
        id: `q-${Date.now()}-${safeQuestionIndex}`,
        question: toText(questionObject.question) || buildFallbackQuestion(safeRole, safeLevel, safeQuestionIndex, safePreviousAnswer).question,
        category: toText(questionObject.category) || "technical",
        difficulty,
        expectedDuration,
        followUps: Array.isArray(questionObject.followUps)
          ? questionObject.followUps.filter((item) => typeof item === "string")
          : [],
      };

      const interviewerReply =
        toText(question.interviewerReply) || buildFallbackInterviewerReply(safePreviousAnswer);

      return NextResponse.json({
        question: sanitizedQuestion,
        interviewerReply,
        source: "ollama-cloud",
      });
    } catch (backendError) {
      console.warn("Cloud next-question generation unavailable, using fallback:", backendError);
      return NextResponse.json({
        question: buildFallbackQuestion(safeRole, safeLevel, safeQuestionIndex, safePreviousAnswer),
        interviewerReply: buildFallbackInterviewerReply(safePreviousAnswer),
        source: "fallback-cloud-error",
      });
    }
  } catch (error) {
    console.error("Error generating next question:", error);
    return NextResponse.json(
      { error: "Failed to generate next question" },
      { status: 500 }
    );
  }
}
