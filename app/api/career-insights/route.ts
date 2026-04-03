import { NextRequest, NextResponse } from "next/server";
import { analyzeCareerProfile } from "@/lib/ai/career-agent";
import { CACHE_TTL, getCachedData } from "@/lib/redis";
import { createHash } from "crypto";

function normalizeSkills(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  return Array.from(
    new Set(
      skills
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort();
}

function buildCacheKey(body: Record<string, unknown>): string {
  const normalized = {
    industry: typeof body.industry === "string" ? body.industry.trim().toLowerCase() : "",
    experience: typeof body.experience === "number" ? body.experience : 0,
    skills: normalizeSkills(body.skills),
    targetRole: typeof body.targetRole === "string" ? body.targetRole.trim().toLowerCase() : "",
  };

  const hash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 24);

  return `career-insights:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { industry, skills, experience, bio, targetRole, recentActivity, completedCourses, weakAreas } = body;

    const cacheKey = buildCacheKey(body as Record<string, unknown>);

    const careerInsight = await getCachedData(
      cacheKey,
      async () =>
        analyzeCareerProfile(
          {
            industry,
            skills: Array.isArray(skills) ? skills : [],
            experience,
            bio,
            targetRole,
          },
          {
            recentActivity,
            completedCourses: Array.isArray(completedCourses) ? completedCourses : undefined,
            weakAreas: Array.isArray(weakAreas) ? weakAreas : undefined,
          }
        ),
      CACHE_TTL.MEDIUM
    );

    return NextResponse.json(careerInsight);
  } catch (error) {
    console.error("Error generating career insights:", error);
    return NextResponse.json(
      { error: "Failed to generate career insights" },
      { status: 500 }
    );
  }
}
