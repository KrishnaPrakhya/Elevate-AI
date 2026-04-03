"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
// analyzeResumeSkillGaps imported but not used - kept for future use
import { getCachedData, CACHE_TTL, invalidateCachePattern } from "@/lib/redis";

// ============================================
// SKILL GAP ANALYSIS & RECOMMENDATIONS
// ============================================

export async function getSkillGapRecommendations(
  currentSkills: string[],
  industry?: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { industryInsight: true },
  });

  if (!user) throw new Error("User not found");

  const userIndustry = industry || user.industry;
  const industryTopSkills = user.industryInsight?.topSkills || [];

  // Find skills the user doesn't have but are important in their industry
  const missingSkills = industryTopSkills.filter(
    (skill) => !currentSkills.some((s) => s.toLowerCase() === skill.toLowerCase())
  );

  if (missingSkills.length === 0) {
    return { skillGaps: [], recommendedPaths: [] };
  }

  // Find learning paths that cover these missing skills
  const recommendedPaths = await db.learningPath.findMany({
    where: {
      isPublished: true,
      OR: [
        { industry: userIndustry },
        { industry: null },
      ],
      modules: {
        some: {
          lessons: {
            some: {
              OR: missingSkills.map((skill) => ({
                title: { contains: skill, mode: "insensitive" },
              })),
            },
          },
        },
      },
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
      _count: { select: { enrollments: true } },
    },
    take: 5,
  });

  // Match missing skills to paths
  const skillGapAnalysis = missingSkills.map((skill) => {
    const relevantPaths = recommendedPaths.filter((path) =>
      path.modules.some((m) =>
        m.lessons.some((l) =>
          l.title.toLowerCase().includes(skill.toLowerCase())
        )
      )
    );

    return {
      skill,
      importance: industryTopSkills.indexOf(skill) < 3 ? "critical" : "important" as const,
      availablePaths: relevantPaths.length,
      pathIds: relevantPaths.map((p) => p.id),
    };
  });

  return {
    skillGaps: skillGapAnalysis,
    recommendedPaths,
  };
}

// ============================================
// TOPIC TO LEARNING PATH MAPPING
// ============================================

export async function getLearningPathForTopic(
  topic: string,
  industry?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const searchIndustry = industry || user.industry;

  // Search for paths matching the topic
  const paths = await db.learningPath.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: topic, mode: "insensitive" } },
        { description: { contains: topic, mode: "insensitive" } },
        { industry: searchIndustry },
      ],
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
    take: 3,
  });

  // If no direct match, try to find lessons matching the topic
  if (paths.length === 0) {
    const matchingLessons = await db.lesson.findMany({
      where: {
        OR: [
          { title: { contains: topic, mode: "insensitive" } },
          { content: { contains: topic, mode: "insensitive" } },
        ],
      },
      include: {
        module: {
          include: {
            learningPath: {
              include: {
                modules: {
                  orderBy: { order: "asc" },
                  include: { lessons: { orderBy: { order: "asc" } } },
                },
              },
            },
          },
        },
      },
      take: 5,
    });

    // Extract unique paths from lessons
    const pathMap = new Map<string, typeof matchingLessons[0] & { module: typeof matchingLessons[0]['module'] }>();
    matchingLessons.forEach((lesson) => {
      if (!pathMap.has(lesson.module.learningPathId)) {
        pathMap.set(lesson.module.learningPathId, lesson.module.learningPath);
      }
    });

    return Array.from(pathMap.values());
  }

  return paths;
}

// ============================================
// QUICK ENROLLMENT WITH CONTEXT
// ============================================

export async function enrollUserInPath(
  learningPathId: string,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  // Check if already enrolled
  const existingEnrollment = await db.enrollment.findUnique({
    where: {
      userId_learningPathId: {
        userId: user.id,
        learningPathId,
      },
    },
  });

  if (existingEnrollment) {
    return { success: false, message: "Already enrolled", enrollment: existingEnrollment };
  }

  // Get the first module and lesson
  const path = await db.learningPath.findUnique({
    where: { id: learningPathId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!path) throw new Error("Learning path not found");

  const firstModule = path.modules[0];
  const firstLesson = firstModule?.lessons[0];

  const enrollment = await db.enrollment.create({
    data: {
      userId: user.id,
      learningPathId,
      currentModuleId: firstModule?.id,
      currentLessonId: firstLesson?.id,
      lastAccessedAt: new Date(),
      // Note: Add 'source' field to schema later for analytics
    },
  });

  // Invalidate relevant caches
  await invalidateCachePattern(`dashboard:*:${user.id}`);
  await invalidateCachePattern(`academy:*:${user.id}`);

  return { success: true, message: "Enrolled successfully", enrollment };
}

// ============================================
// USER LEARNING SUMMARY (for display in career features)
// ============================================

export async function getUserLearningSummary() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      enrollments: {
        where: { progress: { lt: 100 } },
        include: {
          learningPath: true,
        },
      },
      streak: true,
      dailyGoals: {
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      },
    },
  });

  if (!user) throw new Error("User not found");

  // Find the next lesson to complete
  let nextLesson: { title: string; enrollmentId: string; pathTitle: string } | null = null;

  for (const enrollment of user.enrollments) {
    if (enrollment.currentLessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: enrollment.currentLessonId },
      });
      if (lesson) {
        nextLesson = {
          title: lesson.title,
          enrollmentId: enrollment.id,
          pathTitle: enrollment.learningPath.title,
        };
        break;
      }
    }
  }

  const todayGoal = user.dailyGoals[0];
  const weeklyProgress = todayGoal
    ? (todayGoal.actualMinutes / todayGoal.targetMinutes) * 100
    : 0;

  return {
    activeEnrollments: user.enrollments.length,
    nextLesson,
    weeklyProgress,
    streak: user.streak?.currentStreak || 0,
    totalPoints: user.userAchievements?.reduce((acc, ua) => acc + (ua.achievement?.points || 0), 0) || 0,
  };
}

// ============================================
// INTERVIEW WEAKNESS TO LEARNING PATH
// ============================================

export async function getLearningPathForQuizCategory(
  category: string,
  industry?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const searchIndustry = industry || user.industry;

  // Map common interview categories to learning topics
  const topicMapping: Record<string, string[]> = {
    "technical": ["programming", "coding", "algorithms", "data structures"],
    "behavioral": ["communication", "leadership", "teamwork", "problem solving"],
    "system design": ["architecture", "scalability", "distributed systems"],
    "domain knowledge": ["fundamentals", "concepts", "principles"],
  };

  const searchTopics = topicMapping[category.toLowerCase()] || [category];

  const paths = await db.learningPath.findMany({
    where: {
      isPublished: true,
      OR: [
        { industry: searchIndustry },
        { industry: null },
        ...searchTopics.map((topic) => ({
          title: { contains: topic, mode: "insensitive" },
        })),
      ],
    },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
    },
    take: 3,
  });

  return paths;
}

// ============================================
// CACHED WRAPPER FOR PERFORMANCE
// ============================================

export async function getCachedSkillRecommendations(
  currentSkills: string[],
  industry?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const cacheKey = `skill-gaps:${user.id}:${Buffer.from(currentSkills.join(",")).toString("base64").substring(0, 20)}`;

  return getCachedData(
    cacheKey,
    async () => getSkillGapRecommendations(currentSkills, industry),
    CACHE_TTL.MEDIUM
  );
}
