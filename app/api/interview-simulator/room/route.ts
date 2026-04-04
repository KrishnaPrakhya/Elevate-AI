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
    const { roomName, role = "Software Engineer", level = "Mid-Level" } = body;

    // Call FastAPI backend to generate LiveKit token
    const response = await axios.post(`${FASTAPI_URL}/api/livekit/token`, {
      roomName: roomName || `interview-${userId}-${Date.now()}`,
      role,
      level,
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error creating interview room:", error);
    return NextResponse.json(
      { error: "Failed to create interview room" },
      { status: 500 }
    );
  }
}
