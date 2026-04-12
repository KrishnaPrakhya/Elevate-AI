import { NextResponse } from "next/server";

import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalUsers,
      resumesReviewed,
      coverLettersGenerated,
      simulationsRun,
      assessmentsCompleted,
      portfoliosBuilt,
    ] = await Promise.all([
      db.user.count(),
      db.resume.count(),
      db.coverLetter.count(),
      db.simulationAttempt.count(),
      db.assessments.count(),
      db.portfolioArtifact.count(),
    ]);

    return NextResponse.json({
      totalUsers,
      resumesReviewed,
      coverLettersGenerated,
      simulationsRun,
      assessmentsCompleted,
      portfoliosBuilt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching landing metrics:", error);
    return NextResponse.json(
      { error: "Failed to load landing metrics" },
      { status: 500 }
    );
  }
}
