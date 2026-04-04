import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import axios from "axios";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:5000";

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

    let feedbackData: {
      overall: number;
      summary: string;
    };

    try {
      const response = await axios.post(`${FASTAPI_URL}/api/voice-interview/finish`, {
        responses,
        mode,
        duration,
      });
      feedbackData = response.data.feedback;
    } catch (backendError) {
      console.warn("Feedback backend unavailable, generating fallback feedback:", backendError);
      const answeredCount = Array.isArray(responses)
        ? responses.filter((r: { answer?: string }) => (r.answer || "").trim().length > 0).length
        : 0;
      const totalCount = Array.isArray(responses) ? responses.length : 0;
      const completionRatio = totalCount > 0 ? answeredCount / totalCount : 0;
      const overall = Math.max(55, Math.min(95, Math.round(55 + completionRatio * 40)));

      feedbackData = {
        overall,
        summary: `You completed ${answeredCount}/${totalCount} questions in ${duration} minute(s). Focus on structuring answers with Situation, Action, and Result. Add measurable impact in each answer for stronger interviewer confidence.`,
      };
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
