import { NextRequest, NextResponse } from "next/server";
import { analyzeCareerProfile } from "@/lib/ai/career-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { industry, skills, experience } = body;

    const careerInsight = await analyzeCareerProfile({
      industry,
      skills,
      experience,
    });

    return NextResponse.json(careerInsight);
  } catch (error) {
    console.error("Error generating career insights:", error);
    return NextResponse.json(
      { error: "Failed to generate career insights" },
      { status: 500 }
    );
  }
}
