import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { questionIndex, previousAnswer } = body;

    // Generate adaptive next question based on previous answer
    const prompt = `
      Based on the previous answer, generate the next interview question.

      Previous answer: "${previousAnswer}"

      If the previous answer was strong, make the next question slightly harder.
      If the previous answer was weak, make it slightly easier or provide a follow-up.

      Return ONLY a JSON object in this format (no markdown):
      {
        "id": "q-${Date.now()}",
        "question": "The actual question text",
        "category": "Technical | Behavioral | Problem Solving | System Design | Communication",
        "difficulty": "easy | medium | hard",
        "expectedDuration": 120,
        "followUps": ["Optional follow-up 1", "Optional follow-up 2"]
      }

      Expected duration should be 60-180 seconds.
    `;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let questionText = result.choices[0]?.message?.content?.trim() || "";

    // Clean up markdown
    if (questionText.startsWith("```json") || questionText.startsWith("```")) {
      questionText = questionText.replace(/```json|```/g, "").trim();
    }

    const question = JSON.parse(questionText);

    // Sanitize
    const sanitizedQuestion = {
      id: `q-${Date.now()}-${questionIndex}`,
      question: question.question,
      category: question.category || "General",
      difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
      expectedDuration: Math.min(180, Math.max(60, question.expectedDuration || 120)),
      followUps: question.followUps || [],
    };

    return NextResponse.json({ question: sanitizedQuestion });
  } catch (error) {
    console.error("Error generating next question:", error);
    return NextResponse.json(
      { error: "Failed to generate next question" },
      { status: 500 }
    );
  }
}
