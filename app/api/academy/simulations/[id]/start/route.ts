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

// Start a simulation attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: scenarioId } = await params;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const scenario = await db.simulationScenario.findUnique({
      where: { id: scenarioId },
    });

    if (!scenario) {
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 }
      );
    }

    const attempt = await db.simulationAttempt.create({
      data: {
        userId: user.id,
        scenarioId,
        status: "IN_PROGRESS",
      },
    });

    return NextResponse.json({ attempt });
  } catch (error) {
    console.error("Error starting simulation:", error);
    return NextResponse.json(
      { error: "Failed to start simulation" },
      { status: 500 }
    );
  }
}
