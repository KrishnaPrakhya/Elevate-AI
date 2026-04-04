import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role, level, mode, numQuestions = 5 } = body;

    // For voice mode, call FastAPI backend
    if (mode === "voice") {
      const response = await axios.post(`${FASTAPI_URL}/api/voice-interview/start`, {
        role,
        level,
        numQuestions,
      });
      return NextResponse.json(response.data);
    }

    // For text mode, use existing logic or delegate to backend
    const response = await axios.post(`${FASTAPI_URL}/api/voice-interview/start`, {
      role,
      level,
      numQuestions,
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error starting interview:", error);
    return NextResponse.json(
      { error: "Failed to start interview" },
      { status: 500 }
    );
  }
}
