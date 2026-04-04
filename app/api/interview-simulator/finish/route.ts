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

    // Call FastAPI backend for feedback generation
    const response = await axios.post(`${FASTAPI_URL}/api/voice-interview/finish`, {
      responses,
      mode,
      duration,
    });

    const feedbackData = response.data.feedback;

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
