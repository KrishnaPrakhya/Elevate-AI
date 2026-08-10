"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createGroqClient } from "@/lib/ai";
import { parseLLMJson, safeJsonParse } from "@/lib/ai/json";
import {
  computePerformanceIntelligence,
  recordExecutedAction,
} from "@/lib/performance/intelligence";

const model = createGroqClient();

/**
 * Sync academy progress to career plan
 * When user completes lessons, update their career plan skill gaps and progress
 */
export async function syncAcademyProgressToCareerPlan() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      enrollments: {
        include: {
          learningPath: true,
          lessonProgress: {
            include: { lesson: true },
          },
        },
      },
      skillProgress: {
        include: { skill: true },
      },
    },
  });

  if (!user) throw new Error("User not found");

  // Calculate skill mastery from completed lessons
  const skillUpdates: Record<string, number> = {};

  for (const enrollment of user.enrollments) {
    const completedLessons = enrollment.lessonProgress.filter(
      (lp) => lp.status === "COMPLETED"
    );
    const totalLessons = enrollment.lessonProgress.length;
    const completionRate = totalLessons > 0 ? completedLessons.length / totalLessons : 0;

    // Map learning path to skills
    const pathSkills = mapLearningPathToSkills(enrollment.learningPath);

    for (const skillName of pathSkills) {
      const existingProgress = user.skillProgress.find(
        (sp) => sp.skill.name.toLowerCase() === skillName.toLowerCase()
      );

      // Increase mastery based on completion
      const masteryGain = Math.round(completionRate * 20); // Max 20 points per path
      skillUpdates[skillName] = (existingProgress?.masteryLevel || 0) + masteryGain;
    }
  }

  // Update skill progress
  for (const [skillName, masteryLevel] of Object.entries(skillUpdates)) {
    const skill = await db.skillNode.findFirst({
      where: { name: { equals: skillName, mode: "insensitive" } },
    });

    if (skill) {
      await db.userSkillProgress.upsert({
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: skill.id,
          },
        },
        update: {
          masteryLevel: Math.min(100, masteryLevel),
          lastPracticed: new Date(),
        },
        create: {
          userId: user.id,
          skillId: skill.id,
          masteryLevel: Math.min(100, masteryLevel),
        },
      });
    }
  }

  // Trigger career plan update
  await updateCareerPlanFromSkills(user.id);

  revalidatePath("/academy");
  revalidatePath("/dashboard");

  return { success: true, updatedSkills: Object.keys(skillUpdates).length };
}

/**
 * Map learning paths to skill names
 */
function mapLearningPathToSkills(path: any): string[] {
  const skillMap: Record<string, string[]> = {
    "react": ["React", "Frontend Development", "JavaScript", "TypeScript"],
    "nodejs": ["Node.js", "Backend Development", "JavaScript", "API Design"],
    "python": ["Python", "Backend Development", "Data Analysis"],
    "machine-learning": ["Machine Learning", "Python", "Data Science", "Statistics"],
    "system-design": ["System Design", "Architecture", "Scalability"],
    "aws": ["Cloud Computing", "AWS", "DevOps"],
    "docker": ["Docker", "DevOps", "Containerization"],
    "typescript": ["TypeScript", "JavaScript", "Frontend Development"],
  };

  const titleLower = path.title.toLowerCase();

  for (const [key, skills] of Object.entries(skillMap)) {
    if (titleLower.includes(key)) {
      return skills;
    }
  }

  return ["General Programming"];
}

/**
 * Update career plan based on skill improvements
 */
async function updateCareerPlanFromSkills(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      skillProgress: { include: { skill: true } },
      resume: true,
    },
  });

  if (!user) return;

  // Get skills with high mastery
  const strongSkills = user.skillProgress
    .filter((sp) => sp.masteryLevel >= 60)
    .map((sp) => sp.skill.name);

  // Get skills needing improvement
  const weakSkills = user.skillProgress
    .filter((sp) => sp.masteryLevel < 40)
    .map((sp) => sp.skill.name);

  // Generate updated career recommendations
  const prompt = `
    User Industry: ${user.industry || "General"}
    User Experience: ${user.experience || 0} years

    Strong Skills (60%+ mastery): ${strongSkills.join(", ") || "None identified"}
    Skills Needing Improvement (<40% mastery): ${weakSkills.join(", ") || "None identified"}

    Based on the user's skill development, provide updated career plan recommendations:
    1. What roles are they now qualified for?
    2. What skills should they focus on next?
    3. What learning paths would bridge remaining gaps?

    Return JSON:
    {
      "recommendedRoles": ["role1", "role2"],
      "nextSkillsToLearn": ["skill1", "skill2"],
      "suggestedLearningPaths": ["path1", "path2"],
      "careerReadinessScore": number (0-100)
    }
  `;

  try {
    const result = await model.chat.completions.create({
      model: (process.env.GROQ_MODEL || "openai/gpt-oss-20b"),
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = result.choices[0]?.message?.content?.trim() || "";
    const recommendations = parseLLMJson<{
      recommendedRoles: string[];
      nextSkillsToLearn: string[];
      suggestedLearningPaths: string[];
      careerReadinessScore: number;
    }>(responseText, {
      recommendedRoles: [],
      nextSkillsToLearn: [],
      suggestedLearningPaths: [],
      careerReadinessScore: 0,
    });

    // Store in Redis for quick access (career dashboard)
    const redisKey = `career:recommendations:${userId}`;
    await import("@/lib/redis").then(({ redis }) =>
      redis.set(redisKey, JSON.stringify(recommendations), { ex: 60 * 60 * 24 }) // 24 hours
    );

    return recommendations;
  } catch (error) {
    console.error("Error updating career plan:", error);
  }
}

/**
 * Get personalized academy recommendations based on career goals
 */
export async function getAcademyRecommendationsForCareer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      skillProgress: { include: { skill: true } },
      enrollments: { include: { learningPath: true } },
    },
  });

  if (!user) throw new Error("User not found");

  // Get career plan recommendations
  const redisKey = `career:recommendations:${userId}`;
  const redis = await import("@/lib/redis").then(({ redis }) => redis);
  const cachedRecs = await redis.get(redisKey);

  let careerGoals: string[] = [];
  if (cachedRecs) {
    // Upstash may return an already-parsed object or a JSON string; tolerate both.
    const parsed =
      typeof cachedRecs === "string" ? safeJsonParse(cachedRecs) : cachedRecs;
    const skills = (parsed as { nextSkillsToLearn?: unknown } | null)?.nextSkillsToLearn;
    careerGoals = Array.isArray(skills) ? (skills as string[]) : [];
  }

  // Find learning paths that match career goals
  const recommendedPaths = await db.learningPath.findMany({
    where: { isPublished: true },
    include: {
      modules: { include: { lessons: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Score and rank paths based on career relevance
  const scoredPaths = recommendedPaths.map((path) => {
    let score = 0;
    const pathSkills = mapLearningPathToSkills(path);

    // Boost score if path teaches skills from career goals
    for (const goalSkill of careerGoals) {
      if (pathSkills.some((s) => s.toLowerCase().includes(goalSkill.toLowerCase()))) {
        score += 30;
      }
    }

    // Boost if user has related foundational skills
    for (const userSkill of user.skillProgress) {
      if (userSkill.masteryLevel >= 50 &&
          pathSkills.some((s) => s.toLowerCase().includes(userSkill.skill.name.toLowerCase()))) {
        score += 10;
      }
    }

    // Slight boost for popular paths
    score += Math.min(20, path._count.enrollments / 10);

    return { path, score };
  });

  // Sort by score and return top recommendations
  scoredPaths.sort((a, b) => b.score - a.score);

  return scoredPaths.map(({ path, score }) => ({
    ...path,
    relevanceScore: score,
    reason: generateRecommendationReason(path, score),
  }));
}

/**
 * Generate human-readable reason for recommendation
 */
function generateRecommendationReason(path: any, score: number): string {
  if (score >= 50) {
    return "Highly recommended based on your career goals";
  } else if (score >= 30) {
    return `Great fit for building on your existing ${path.title} skills`;
  } else {
    return "Complements your learning journey";
  }
}

/**
 * Auto-enroll user in recommended path when they reach a career milestone
 */
export async function checkAndAutoEnrollForMilestone() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      skillProgress: { include: { skill: true } },
      enrollments: { include: { learningPath: true } },
    },
  });

  if (!user) throw new Error("User not found");

  // Check if any skill just reached a milestone (40%, 70%, 90%)
  const milestoneSkills = user.skillProgress.filter((sp) => {
    const milestone = [40, 70, 90].find((m) =>
      sp.masteryLevel >= m && sp.masteryLevel < m + 5
    );
    return milestone !== undefined;
  });

  if (milestoneSkills.length === 0) {
    return { autoEnrollment: null };
  }

  // Find advanced learning paths for milestone skills
  for (const ms of milestoneSkills) {
    const advancedPath = await db.learningPath.findFirst({
      where: {
        isPublished: true,
        title: {
          contains: ms.skill.name,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (advancedPath && !user.enrollments.some((e) => e.learningPathId === advancedPath.id)) {
      // Auto-enroll in advanced path
      const enrollment = await db.enrollment.create({
        data: {
          userId: user.id,
          learningPathId: advancedPath.id,
          progress: 0,
        },
      });

      return {
        autoEnrollment: {
          activated: true,
          learningPathId: advancedPath.id,
          learningPathTitle: advancedPath.title,
          reason: `Congratulations on reaching ${ms.masteryLevel}% mastery in ${ms.skill.name}!`,
        },
      };
    }
  }

  return { autoEnrollment: null };
}

/**
 * Get skill gap analysis comparing current skills to target role
 */
export async function analyzeSkillGapsForRole(targetRole: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      skillProgress: { include: { skill: true } },
    },
  });

  if (!user) throw new Error("User not found");

  const currentSkills = user.skillProgress.map((sp) => ({
    name: sp.skill.name,
    mastery: sp.masteryLevel,
  }));

  const prompt = `
    Target Role: ${targetRole}
    User Industry: ${user.industry || "General"}

    Current Skills:
    ${currentSkills.map((s) => `- ${s.name}: ${s.mastery}% mastery`).join("\n")}

    Analyze the skill gaps between current abilities and the target role requirements.
    Return JSON:
    {
      "gaps": [
        {
          "skill": "skill name",
          "requiredLevel": number (0-100),
          "currentLevel": number (0-100),
          "gap": number (0-100),
          "priority": "high" | "medium" | "low",
          "learningResources": ["resource1", "resource2"]
        }
      ],
      "estimatedTimeToReady": "X months",
      "readinessPercentage": number (0-100)
    }
  `;

  try {
    const result = await model.chat.completions.create({
      model: (process.env.GROQ_MODEL || "openai/gpt-oss-20b"),
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = result.choices[0]?.message?.content?.trim() || "";
    return parseLLMJson(responseText, {
      gaps: [],
      estimatedTimeToReady: "Unknown",
      readinessPercentage: 0,
    });
  } catch (error) {
    console.error("Error analyzing skill gaps:", error);
    return {
      gaps: [],
      estimatedTimeToReady: "Unknown",
      readinessPercentage: 0,
    };
  }
}

/**
 * INTERVIEW -> ACADEMY cascade.
 * Recommend published learning paths that address a user's weak areas. Weak
 * areas are sourced from (in priority order): explicit input, the active career
 * plan's top gaps, and the performance-intelligence weak-area signals (which
 * now include low quiz/interview scores and low skill mastery). This closes the
 * loop so struggling in interviews surfaces concrete learning paths.
 */
export async function getRecommendedPathsForWeakAreas(
  explicitWeakAreas: string[] = []
): Promise<{
  weakAreas: string[];
  paths: { id: string; title: string; description: string; reason: string }[];
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, industry: true, targetRole: true },
  });
  if (!user) throw new Error("User not found");

  // Gather weak areas from all available growth signals.
  const weakAreaSet = new Set<string>(
    explicitWeakAreas.map((w) => w.trim()).filter(Boolean)
  );

  const [activePlan, performance] = await Promise.all([
    db.careerPlan
      .findFirst({ where: { userId: user.id, isActive: true }, orderBy: { version: "desc" } })
      .catch(() => null),
    computePerformanceIntelligence({ userId: user.id, targetRole: user.targetRole }).catch(
      () => null
    ),
  ]);

  const planGaps =
    (activePlan?.planDetails as { topGaps?: { skill: string }[] } | null)?.topGaps || [];
  planGaps.forEach((g) => g?.skill && weakAreaSet.add(g.skill));
  (performance?.weakAreas || []).forEach((w) => weakAreaSet.add(w));

  const weakAreas = Array.from(weakAreaSet).slice(0, 8);

  if (weakAreas.length === 0) {
    return { weakAreas, paths: [] };
  }

  // Find published paths whose title/description match any weak area, or match
  // the user's industry as a fallback signal.
  const paths = await db.learningPath.findMany({
    where: {
      isPublished: true,
      OR: [
        ...weakAreas.flatMap((area) => [
          { title: { contains: area, mode: "insensitive" as const } },
          { description: { contains: area, mode: "insensitive" as const } },
        ]),
        ...(user.industry ? [{ industry: user.industry }] : []),
      ],
    },
    select: { id: true, title: true, description: true },
    take: 5,
  });

  return {
    weakAreas,
    paths: paths.map((p) => ({
      ...p,
      reason: "Targets a weak area identified from your quizzes, interviews, or career plan.",
    })),
  };
}

/**
 * ACADEMY -> RESUME/PROFILE cascade.
 * Merge skills the user has demonstrably built in the Academy (mastery >=
 * threshold) into their profile skills array, so the resume/cover-letter AI
 * context and career planner reflect what they actually learned.
 * Returns the skills that were newly added.
 */
export async function syncMasteredSkillsToProfile(
  masteryThreshold = 60
): Promise<{ addedSkills: string[] }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { skillProgress: { include: { skill: true } } },
  });
  if (!user) throw new Error("User not found");

  const existing = new Set((user.skills || []).map((s) => s.toLowerCase()));
  const mastered = user.skillProgress
    .filter((sp) => sp.masteryLevel >= masteryThreshold)
    .map((sp) => sp.skill.name)
    .filter((name) => !existing.has(name.toLowerCase()));

  const addedSkills = Array.from(new Set(mastered));
  if (addedSkills.length === 0) {
    return { addedSkills: [] };
  }

  await db.user.update({
    where: { id: user.id },
    data: { skills: { set: [...(user.skills || []), ...addedSkills] } },
  });

  await recordExecutedAction({
    userId: user.id,
    type: "UPDATE_PROGRESS",
    title: `Added ${addedSkills.length} mastered skill${addedSkills.length === 1 ? "" : "s"} to profile`,
    description: `Academy-mastered skills were added to your profile: ${addedSkills.join(", ")}.`,
    params: { addedSkills },
    metadata: {
      source: "academy-to-profile",
      reason: "Learned skills now flow into resume/cover-letter AI context and career planning.",
    },
  });

  revalidatePath("/resume");
  revalidatePath("/dashboard");

  return { addedSkills };
}
