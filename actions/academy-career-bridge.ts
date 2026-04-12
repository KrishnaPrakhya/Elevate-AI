"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

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
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
    });

    let responseText = result.choices[0]?.message?.content?.trim() || "";
    if (responseText.startsWith("```json") || responseText.startsWith("```")) {
      responseText = responseText.replace(/```json|```/g, "").trim();
    }

    const recommendations = JSON.parse(responseText);

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
    const parsed = JSON.parse(cachedRecs as string);
    careerGoals = (parsed as any).nextSkillsToLearn || [];
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
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
    });

    let responseText = result.choices[0]?.message?.content?.trim() || "";
    if (responseText.startsWith("```json") || responseText.startsWith("```")) {
      responseText = responseText.replace(/```json|```/g, "").trim();
    }

    const analysis = JSON.parse(responseText);
    return analysis;
  } catch (error) {
    console.error("Error analyzing skill gaps:", error);
    return {
      gaps: [],
      estimatedTimeToReady: "Unknown",
      readinessPercentage: 0,
    };
  }
}
