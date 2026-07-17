import { NextRequest, NextResponse } from "next/server";
import { analyzeCareerProfile } from "@/lib/ai/career-agent";
import { CACHE_TTL, getCachedData } from "@/lib/redis";
import { createHash } from "crypto";

export const maxDuration = 60;

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

function buildFallbackInsight(body: Record<string, unknown>) {
  const targetRole =
    typeof body.targetRole === "string" && body.targetRole.trim()
      ? body.targetRole.trim()
      : "your target role";

  return {
    skillGaps: [
      {
        skill: "Role-specific portfolio evidence",
        importance: 8,
        learnedVia: "Build or refine one project that demonstrates the target role responsibilities.",
      },
      {
        skill: "Interview communication",
        importance: 7,
        learnedVia: "Practice concise STAR-style answers and technical trade-off explanations.",
      },
    ],
    marketTrends: [
      {
        trend: "AI-assisted workflows",
        impact: "positive",
        description:
          "Employers increasingly value candidates who can use AI tools to move faster while still validating quality and security.",
      },
    ],
    recommendedActions: [
      {
        type: "skill",
        title: `Map your current skills to ${targetRole}`,
        description:
          "List the top responsibilities for the role and attach one proof point, project, or metric to each.",
        priority: "high",
        reasoning:
          "Clear evidence makes resumes, interviews, and portfolio reviews stronger even when AI services are temporarily unavailable.",
      },
    ],
    careerPathSuggestions: [
      {
        role: targetRole,
        matchScore: 70,
        skillsNeeded: ["Portfolio proof", "Interview practice", "Role-specific projects"],
      },
    ],
    source: "fallback",
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
    const { industry, skills, experience, bio, targetRole, recentActivity, completedCourses, weakAreas } = body;

    const cacheKey = buildCacheKey(body as Record<string, unknown>);
    const safeIndustry = typeof industry === "string" ? industry : null;
    const safeExperience = typeof experience === "number" ? experience : null;
    const safeBio = typeof bio === "string" ? bio : null;
    const safeTargetRole = typeof targetRole === "string" ? targetRole : undefined;
    const safeRecentActivity =
      typeof recentActivity === "string" ? recentActivity : undefined;

    const careerInsight = await getCachedData(
      cacheKey,
      async () =>
        analyzeCareerProfile(
          {
            industry: safeIndustry,
            skills: Array.isArray(skills) ? skills : [],
            experience: safeExperience,
            bio: safeBio,
            targetRole: safeTargetRole,
          },
          {
            recentActivity: safeRecentActivity,
            completedCourses: Array.isArray(completedCourses) ? completedCourses : undefined,
            weakAreas: Array.isArray(weakAreas) ? weakAreas : undefined,
          }
        ),
      CACHE_TTL.MEDIUM
    );

    return NextResponse.json(careerInsight);
  } catch (error) {
    console.error("Error generating career insights:", error);
    return NextResponse.json(buildFallbackInsight(body));
  }
}
