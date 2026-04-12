import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud";

const client = ollamaApiKey
  ? new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl })
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

const buildFallbackQuestions = (role: string, level: string, numQuestions: number) => {
  const templates = [
    `Tell me about yourself and why you are a good fit for this ${level} ${role} role.`,
    "Describe a challenging technical problem you solved recently and your approach.",
    "How do you prioritize tasks when deadlines are tight?",
    "Explain a trade-off decision you made in system or feature design.",
    "What would your first 90 days look like in this role?",
  ];

  const safeCount = Math.max(1, Math.min(numQuestions, 10));
  return Array.from({ length: safeCount }, (_, index) => {
    const template = templates[index % templates.length];
    const difficulty =
      index < Math.ceil(safeCount * 0.3)
        ? "easy"
        : index < Math.ceil(safeCount * 0.75)
        ? "medium"
        : "hard";

    return {
      id: `q-${index + 1}`,
      question: template,
      category: index % 2 === 0 ? "behavioral" : "technical",
      difficulty,
      expectedDuration: difficulty === "hard" ? 150 : 120,
    };
  });
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractJsonArray = (value: string) => {
  const cleaned = value.replace(/```json|```/g, "").trim();
  const direct = safeJsonParse(cleaned);
  if (Array.isArray(direct)) {
    return direct;
  }

  const startIndex = cleaned.indexOf("[");
  const endIndex = cleaned.lastIndexOf("]");
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return [];
  }

  const extracted = cleaned.slice(startIndex, endIndex + 1);
  const parsed = safeJsonParse(extracted);
  return Array.isArray(parsed) ? parsed : [];
};

const sanitizeQuestions = (
  raw: Array<Record<string, unknown>>,
  numQuestions: number
) =>
  raw.slice(0, numQuestions).map((question, index) => ({
    id: typeof question.id === "string" ? question.id : `q-${index + 1}`,
    question: typeof question.question === "string" ? question.question : "",
    category: typeof question.category === "string" ? question.category : "behavioral",
    difficulty:
      question.difficulty === "easy" || question.difficulty === "hard"
        ? question.difficulty
        : "medium",
    expectedDuration:
      typeof question.expectedDuration === "number"
        ? Math.min(180, Math.max(60, question.expectedDuration))
        : 120,
    followUps: Array.isArray(question.followUps)
      ? question.followUps.filter((item) => typeof item === "string")
      : [],
  }));

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role, level, mode, numQuestions = 5 } = body;
    const safeNumQuestions = Math.min(10, Math.max(3, Number(numQuestions) || 5));
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

    if (!client) {
      return NextResponse.json({
        questions: buildFallbackQuestions(
          safeRole,
          safeLevel,
          safeNumQuestions
        ),
        role: safeRole,
        level: safeLevel,
        mode,
        source: "fallback-no-cloud-key",
      });
    }

    const prompt = `Generate ${safeNumQuestions} interview questions for a ${safeLevel} ${safeRole} candidate.
Return ONLY a JSON array. Each item must include:
- id: string
- question: string
- category: behavioral | technical | problem-solving | system-design | communication
- difficulty: easy | medium | hard
- expectedDuration: number (seconds, 60-180)
- followUps: string[] (optional)
Avoid markdown or extra text.`;

    try {
      const result = await client.chat.completions.create({
        model: ollamaModel,
        messages: [
          {
            role: "system",
            content:
              "You are a senior interviewer creating realistic, role-specific mock interview questions.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      });

      const content = result.choices[0]?.message?.content?.trim() || "";
      const rawQuestions = extractJsonArray(content);
      const questions = sanitizeQuestions(rawQuestions, safeNumQuestions).filter(
        (question) => question.question.length > 0
      );

      if (!questions.length) {
        return NextResponse.json({
          questions: buildFallbackQuestions(
            safeRole,
            safeLevel,
            safeNumQuestions
          ),
          role: safeRole,
          level: safeLevel,
          mode,
          source: "fallback-invalid-model-output",
        });
      }

      return NextResponse.json({
        questions,
        role: safeRole,
        level: safeLevel,
        mode,
        source: "ollama-cloud",
      });
    } catch (backendError) {
      console.warn("Cloud question generation unavailable, using fallback:", backendError);
      return NextResponse.json({
        questions: buildFallbackQuestions(
          safeRole,
          safeLevel,
          safeNumQuestions
        ),
        role: safeRole,
        level: safeLevel,
        mode,
        source: "fallback-cloud-error",
      });
    }
  } catch (error) {
    console.error("Error starting interview:", error);
    return NextResponse.json(
      { error: "Failed to start interview" },
      { status: 500 }
    );
  }
}
