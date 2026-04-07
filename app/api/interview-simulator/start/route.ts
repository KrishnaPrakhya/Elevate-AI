import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || "ollama";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:latest";

const client = new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl });

const buildFallbackQuestions = (role: string, level: string, numQuestions: number) => {
  const templates = [
    `Tell me about yourself and why you are a good fit for this ${level} ${role} role.`,
    "Describe a challenging technical problem you solved recently and your approach.",
    "How do you prioritize tasks when deadlines are tight?",
    "Explain a trade-off decision you made in system or feature design.",
    "What would your first 90 days look like in this role?",
  ];

  return templates.slice(0, Math.max(1, Math.min(numQuestions, 5))).map((question, index) => ({
    id: `q-${index + 1}`,
    question,
    category: index % 2 === 0 ? "behavioral" : "technical",
    difficulty: index < 2 ? "easy" : index < 4 ? "medium" : "hard",
    expectedDuration: 120,
  }));
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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

    const prompt = `Generate ${numQuestions} interview questions for a ${level} ${role} candidate.
Return ONLY a JSON array. Each item must include:
- id: string
- question: string
- category: behavioral | technical | problem-solving | system-design | communication
- difficulty: easy | medium | hard
- expectedDuration: number (seconds, 60-180)
- followUps: string[] (optional)
Avoid markdown or extra text.`;

    const result = await client.chat.completions.create({
      model: ollamaModel,
      messages: [
        {
          role: "system",
          content: "You are a senior interviewer creating realistic mock interview questions.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    });

    let content = result.choices[0]?.message?.content?.trim() || "";
    content = content.replace(/```json|```/g, "").trim();
    const parsed = safeJsonParse(content);
    const rawQuestions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
      ? parsed.questions
      : [];

    const questions = sanitizeQuestions(rawQuestions, numQuestions).filter(
      (question) => question.question.length > 0
    );

    if (!questions.length) {
      return NextResponse.json({
        questions: buildFallbackQuestions(
          role || "Software Engineer",
          level || "Mid-Level",
          numQuestions
        ),
        role,
        level,
        mode,
        source: "fallback",
      });
    }

    return NextResponse.json({
      questions,
      role,
      level,
      mode,
      source: "ollama",
    });
  } catch (error) {
    console.error("Error starting interview:", error);
    return NextResponse.json(
      { error: "Failed to start interview" },
      { status: 500 }
    );
  }
}
