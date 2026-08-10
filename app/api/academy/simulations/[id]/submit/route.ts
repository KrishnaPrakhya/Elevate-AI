import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createGroqClient } from "@/lib/ai";
import { parseLLMJson } from "@/lib/ai/json";
import { recordExecutedAction } from "@/lib/performance/intelligence";
import { ASSESSMENT_CATEGORY } from "@/lib/growth/categories";

export const maxDuration = 60;

const model = createGroqClient();

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

    // Ensure the attempt belongs to the requesting user (prevent IDOR).
    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      model: (process.env.GROQ_MODEL || "openai/gpt-oss-20b"),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const evaluationText = result.choices[0]?.message?.content?.trim() || "";

    const rawEvaluation = parseLLMJson<{
      score?: unknown;
      feedback?: unknown;
      strengths?: unknown;
      improvements?: unknown;
      skillMasteryDelta?: unknown;
    }>(evaluationText, {});

    const clamp = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
    };

    // Validate & sanitize so a malformed model response can't store garbage
    const evaluation = {
      score: clamp(rawEvaluation.score, 0, 100, 60),
      feedback:
        typeof rawEvaluation.feedback === "string" && rawEvaluation.feedback.trim().length > 0
          ? rawEvaluation.feedback.trim()
          : "Evaluation completed. Keep practicing to improve your performance.",
      strengths: Array.isArray(rawEvaluation.strengths)
        ? rawEvaluation.strengths.filter((s) => typeof s === "string")
        : [],
      improvements: Array.isArray(rawEvaluation.improvements)
        ? rawEvaluation.improvements.filter((s) => typeof s === "string")
        : [],
      skillMasteryDelta: clamp(rawEvaluation.skillMasteryDelta, 0, 10, 1),
    };

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

    // Update user skill progress if primary skill exists (upsert so first-time
    // practice of a skill still creates a progress record).
    if (attempt.scenario.primarySkillId) {
      const existing = await db.userSkillProgress.findUnique({
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: attempt.scenario.primarySkillId,
          },
        },
      });

      await db.userSkillProgress.upsert({
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: attempt.scenario.primarySkillId,
          },
        },
        update: {
          masteryLevel: Math.min(100, (existing?.masteryLevel ?? 0) + evaluation.skillMasteryDelta),
          lastPracticed: new Date(),
        },
        create: {
          userId: user.id,
          skillId: attempt.scenario.primarySkillId,
          masteryLevel: Math.min(100, evaluation.skillMasteryDelta),
          lastPracticed: new Date(),
        },
      });
    }

    // Record as an assessment so academy simulations show up in performance
    // intelligence (interview-readiness bucket) alongside mock interviews.
    const assessmentQuestions: Prisma.InputJsonValue[] = Array.isArray(responses)
      ? responses
      : Array.isArray(transcript)
      ? transcript
      : [];

    await db.assessments.create({
      data: {
        userId: user.id,
        quizScore: evaluation.score,
        questions: assessmentQuestions,
        category: ASSESSMENT_CATEGORY.ACADEMY_SIMULATION,
        improvementTip: evaluation.feedback,
      },
    });

    await recordExecutedAction({
      userId: user.id,
      type: "UPDATE_PROGRESS",
      title: `Simulation completed (${evaluation.score}%)`,
      description: "An academy scenario simulation was completed and scored.",
      params: { attemptId, scenarioId: attempt.scenarioId },
      result: { score: evaluation.score, skillMasteryDelta: evaluation.skillMasteryDelta },
      metadata: {
        source: "academy-simulation",
        reason: "Simulation outcomes feed interview-readiness trends and skill mastery.",
      },
    });

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
