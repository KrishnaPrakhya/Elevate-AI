import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

// Submit simulation and get AI evaluation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: attemptId } = await params;
    const body = await request.json();
    const { transcript, responses } = body;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        skillProgress: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const attempt = await db.simulationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        scenario: {
          include: {
            primarySkill: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Generate AI evaluation
    const prompt = `
      Evaluate the following simulation attempt.

      Scenario: ${attempt.scenario.title}
      Description: ${attempt.scenario.description}
      Success Criteria: ${attempt.scenario.successCriteria}

      User's Transcript/Responses:
      ${JSON.stringify(transcript || responses, null, 2)}

      Provide evaluation in this JSON format (no markdown):
      {
        "score": number (0-100),
        "feedback": "Detailed feedback on performance",
        "strengths": ["strength 1", "strength 2"],
        "improvements": ["improvement 1", "improvement 2"],
        "skillMasteryDelta": number (0-10, how much skill improved)
      }
    `;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    let evaluationText = result.choices[0]?.message?.content?.trim() || "";

    // Clean up markdown
    if (evaluationText.startsWith("```json") || evaluationText.startsWith("```")) {
      evaluationText = evaluationText.replace(/```json|```/g, "").trim();
    }

    const evaluation = JSON.parse(evaluationText);

    // Update attempt
    const updatedAttempt = await db.simulationAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        score: evaluation.score,
        feedback: evaluation.feedback,
        transcript: transcript || responses,
        completedAt: new Date(),
      },
    });

    // Update user skill progress if primary skill exists
    if (attempt.scenario.primarySkillId) {
      const skillProgress = await db.userSkillProgress.findUnique({
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: attempt.scenario.primarySkillId,
          },
        },
      });

      if (skillProgress) {
        await db.userSkillProgress.update({
          where: {
            userId_skillId: {
              userId: user.id,
              skillId: attempt.scenario.primarySkillId,
            },
          },
          data: {
            masteryLevel: Math.min(100, skillProgress.masteryLevel + (evaluation.skillMasteryDelta || 1)),
            lastPracticed: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      attempt: updatedAttempt,
      evaluation,
    });
  } catch (error) {
    console.error("Error submitting simulation:", error);
    return NextResponse.json(
      { error: "Failed to submit simulation" },
      { status: 500 }
    );
  }
}
