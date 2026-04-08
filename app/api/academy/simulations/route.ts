import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import type { PathLevel, Prisma, SimulationType } from "@prisma/client";

const validDifficulties: PathLevel[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
];

const validSimulationTypes: SimulationType[] = [
  "TECHNICAL",
  "SOFT_SKILL",
  "NEGOTIATION",
  "DEBUGGING",
  "SYSTEM_DESIGN",
];

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

    const where: Prisma.SimulationScenarioWhereInput = {};
    if (type && validSimulationTypes.includes(type as SimulationType)) {
      where.type = type as SimulationType;
    }
    if (
      difficulty &&
      validDifficulties.includes(difficulty as PathLevel)
    ) {
      where.difficulty = difficulty as PathLevel;
    }

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
        difficulty: validDifficulties.includes(difficulty as PathLevel)
          ? (difficulty as PathLevel)
          : "BEGINNER",
        type: validSimulationTypes.includes(type as SimulationType)
          ? (type as SimulationType)
          : "TECHNICAL",
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
