import { db } from "@/lib/prisma";
import {
  computePerformanceIntelligence,
  type PerformanceStats,
} from "@/lib/performance/intelligence";

/**
 * Canonical, cross-feature snapshot of a user's growth.
 *
 * This is the single source of truth every surface (chatbot, career planner,
 * dashboard, academy) should consume so the platform presents ONE consistent
 * picture of the user instead of each feature assembling its own ad-hoc subset.
 */
export type UserGrowthContext = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    name: string | null;
    industry: string | null;
    experience: number | null;
    skills: string[];
    bio: string | null;
    targetRole: string | null;
  };
  documents: {
    hasResume: boolean;
    resumeContent: string | null;
    hasCoverLetter: boolean;
    latestCoverLetter: string | null;
  };
  assessments: {
    category: string;
    score: number;
    improvementTip: string | null;
    createdAt: string;
  }[];
  skills: { name: string; mastery: number }[];
  learning: {
    activePaths: { title: string; progress: number; currentLesson: string | null }[];
  };
  careerPlan: {
    targetRole: string;
    version: number;
    topGaps: { skill: string; importance: number }[];
    topActions: { title: string; priority: string; description: string }[];
  } | null;
  performance: {
    stats: PerformanceStats;
    weakAreas: string[];
  };
  portfolio: {
    bestScore: number | null;
    artifactCount: number;
  };
  streak: { current: number; longest: number } | null;
};

type PlanDetails = {
  topGaps?: { skill: string; importance: number }[];
  topActions?: { title: string; priority: string; description: string }[];
};

/**
 * Build the unified growth context for a user. Accepts a Clerk user id.
 * Returns null if the user does not exist.
 *
 * Every sub-read is best-effort; a failure in one area (e.g. the optional
 * CareerPlan table before its migration is applied) degrades that slice to a
 * safe default rather than failing the whole context.
 */
export async function getUserGrowthContext(
  clerkUserId: string
): Promise<UserGrowthContext | null> {
  const user = await db.user.findUnique({
    where: { clerkUserId },
    include: {
      resume: true,
      coverLetter: { orderBy: { updatedAt: "desc" }, take: 1 },
      assessments: { orderBy: { createdAt: "desc" }, take: 5 },
      skillProgress: { include: { skill: true } },
      enrollments: {
        where: { progress: { lt: 100 } },
        include: {
          learningPath: true,
          lessonProgress: { include: { lesson: true } },
        },
      },
    },
  });

  if (!user) return null;

  // Parallel, independent reads that aren't part of the user include above.
  const [performance, activePlanRow, portfolioArtifacts, streak] = await Promise.all([
    computePerformanceIntelligence({ userId: user.id, targetRole: user.targetRole }).catch(
      () => null
    ),
    db.careerPlan
      .findFirst({ where: { userId: user.id, isActive: true }, orderBy: { version: "desc" } })
      .catch(() => null),
    db.portfolioArtifact
      .findMany({ where: { userId: user.id }, select: { aiReview: true } })
      .catch(() => [] as { aiReview: unknown }[]),
    db.streak.findUnique({ where: { userId: user.id } }).catch(() => null),
  ]);

  // Best portfolio score across artifacts (aiReview.score is a 0-100 number).
  let bestScore: number | null = null;
  for (const artifact of portfolioArtifacts) {
    const review = artifact.aiReview as { score?: unknown } | null;
    const score = typeof review?.score === "number" ? review.score : null;
    if (score !== null && (bestScore === null || score > bestScore)) {
      bestScore = score;
    }
  }

  const planDetails = (activePlanRow?.planDetails as PlanDetails | null) || null;

  return {
    user: {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      industry: user.industry,
      experience: user.experience,
      skills: user.skills || [],
      bio: user.bio,
      targetRole: user.targetRole,
    },
    documents: {
      hasResume: Boolean(user.resume?.content),
      resumeContent: user.resume?.content ?? null,
      hasCoverLetter: (user.coverLetter?.length ?? 0) > 0,
      latestCoverLetter: user.coverLetter?.[0]?.content ?? null,
    },
    assessments: user.assessments.map((a) => ({
      category: a.category,
      score: a.quizScore,
      improvementTip: a.improvementTip,
      createdAt: a.createdAt.toISOString(),
    })),
    skills: user.skillProgress.map((sp) => ({
      name: sp.skill.name,
      mastery: sp.masteryLevel,
    })),
    learning: {
      activePaths: user.enrollments.map((e) => ({
        title: e.learningPath.title,
        progress: e.progress,
        currentLesson:
          e.lessonProgress.find((lp) => lp.status === "IN_PROGRESS")?.lesson.title ?? null,
      })),
    },
    careerPlan: activePlanRow
      ? {
          targetRole: activePlanRow.targetRole,
          version: activePlanRow.version,
          topGaps: planDetails?.topGaps ?? [],
          topActions: planDetails?.topActions ?? [],
        }
      : null,
    performance: {
      stats: performance?.stats ?? {
        technicalQuizAverage: null,
        interviewSimulationAverage: null,
        technicalQuizAttempts14d: 0,
        interviewSimulations14d: 0,
        lessonsCompleted7d: 0,
        activeEnrollments: 0,
        operationsTracked7d: 0,
        skillMasteryAverage: null,
        skillsTracked: 0,
      },
      weakAreas: performance?.weakAreas ?? [],
    },
    portfolio: {
      bestScore,
      artifactCount: portfolioArtifacts.length,
    },
    streak: streak ? { current: streak.currentStreak, longest: streak.longestStreak } : null,
  };
}

/**
 * Render the growth context into a compact text block suitable for injecting
 * into an LLM prompt. Keeps all AI surfaces grounded in the SAME facts.
 */
export function formatGrowthContextForPrompt(ctx: UserGrowthContext): string {
  const lines: string[] = [];
  lines.push(`Name: ${ctx.user.name || "Not provided"}`);
  lines.push(`Industry: ${ctx.user.industry || "Not specified"}`);
  lines.push(`Experience: ${ctx.user.experience ?? 0} years`);
  lines.push(`Target Role: ${ctx.user.targetRole || "Not specified"}`);
  lines.push(`Skills: ${ctx.user.skills.join(", ") || "Not specified"}`);

  if (ctx.skills.length) {
    lines.push(
      `Tracked skill mastery: ${ctx.skills
        .map((s) => `${s.name} (${s.mastery}%)`)
        .join(", ")}`
    );
  }

  if (ctx.assessments.length) {
    lines.push(
      `Recent assessments: ${ctx.assessments
        .map((a) => `${a.category} ${a.score}%`)
        .join(", ")}`
    );
  }

  if (ctx.learning.activePaths.length) {
    lines.push(
      `Active learning: ${ctx.learning.activePaths
        .map((p) => `${p.title} (${p.progress}%)`)
        .join(", ")}`
    );
  }

  if (ctx.careerPlan) {
    lines.push(
      `Active career plan -> ${ctx.careerPlan.targetRole}; top gaps: ${
        ctx.careerPlan.topGaps.map((g) => g.skill).join(", ") || "none"
      }`
    );
  }

  if (ctx.performance.weakAreas.length) {
    lines.push(`Identified weak areas: ${ctx.performance.weakAreas.join(", ")}`);
  }

  if (ctx.portfolio.bestScore !== null) {
    lines.push(`Best portfolio score: ${ctx.portfolio.bestScore}/100`);
  }

  if (ctx.streak) {
    lines.push(`Learning streak: ${ctx.streak.current} days (best ${ctx.streak.longest})`);
  }

  return lines.join("\n");
}
