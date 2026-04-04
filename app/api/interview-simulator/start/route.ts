import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:5000";

const isPlaceholderQuestionSet = (questions: Array<{ question?: string }> = []) =>
  questions.some((q) =>
    (q.question || "").toLowerCase().includes("detailed questions will be asked by voice agent")
  );

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
  }));
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role, level, mode, numQuestions = 5 } = body;

    try {
      const response = await axios.post(`${FASTAPI_URL}/api/voice-interview/start`, {
        role,
        level,
        numQuestions,
      });

      const backendQuestions = response.data?.questions || [];
      if (!Array.isArray(backendQuestions) || !backendQuestions.length || isPlaceholderQuestionSet(backendQuestions)) {
        return NextResponse.json({
          questions: buildFallbackQuestions(role || "Software Engineer", level || "Mid-Level", numQuestions),
          role,
          level,
          mode,
          source: "fallback",
        });
      }

      return NextResponse.json(response.data);
    } catch (backendError) {
      console.warn("Voice interview backend unavailable, using fallback questions:", backendError);
      return NextResponse.json({
        questions: buildFallbackQuestions(role || "Software Engineer", level || "Mid-Level", numQuestions),
        role,
        level,
        mode,
        source: "fallback",
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
