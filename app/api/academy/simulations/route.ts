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

// Get all available simulations
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");

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

    const where: any = {};
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;

    const simulations = await db.simulationScenario.findMany({
      where,
      include: {
        primarySkill: true,
        attempts: {
          where: { userId: user.id },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({ simulations });
  } catch (error) {
    console.error("Error loading simulations:", error);
    return NextResponse.json(
      { error: "Failed to load simulations" },
      { status: 500 }
    );
  }
}

// Create a new simulation scenario (admin/mentor only)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      difficulty,
      type,
      aiPrompt,
      successCriteria,
      primarySkillId,
    } = body;

    if (!title || !description || !aiPrompt || !successCriteria) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const simulation = await db.simulationScenario.create({
      data: {
        title,
        description,
        difficulty: difficulty || "BEGINNER",
        type: type || "TECHNICAL",
        aiPrompt,
        successCriteria,
        primarySkillId,
      },
    });

    return NextResponse.json({ simulation });
  } catch (error) {
    console.error("Error creating simulation:", error);
    return NextResponse.json(
      { error: "Failed to create simulation" },
      { status: 500 }
    );
  }
}

// Start a new simulation attempt - POST with start action
// Handled in /api/academy/simulations/[id]/start/route.ts
