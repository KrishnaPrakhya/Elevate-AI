"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { analyzeCareerProfile, recommendLearningPath } from "@/lib/ai/career-agent";
import { revalidatePath } from "next/cache";

export interface OnboardingData {
  industry: string;
  experience: string;
  bio: string;
  skills: string[];
  careerGoals?: string[];
  targetRole?: string;
  availableHoursPerWeek?: number;
  learningTimeline?: "1 month" | "3 months" | "6 months" | "1 year";
}

export async function completeOnboardingWithAI(data: OnboardingData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const result = await db.$transaction(async (tx) => {
      // Update user profile
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          industry: data.industry,
          experience: parseInt(data.experience),
          bio: data.bio,
          skills: data.skills,
        },
      });

      // Generate AI-powered career insights
      const careerInsight = await analyzeCareerProfile({
        industry: data.industry,
        experience: parseInt(data.experience),
        skills: data.skills,
        bio: data.bio,
        targetRole: data.targetRole,
        careerGoals: data.careerGoals,
      });

      // Create or update industry insight
      let industryInsight = await tx.industryInsight.findUnique({
        where: { industry: data.industry },
      });

      if (!industryInsight) {
        industryInsight = await tx.industryInsight.create({
          data: {
            industry: data.industry,
            topSkills: careerInsight.skillGaps.map((g) => g.skill),
            growthRate: 5.0,
            demandLevel: "HIGH",
            marketOutLook: "POSITIVE",
            keyTrends: careerInsight.marketTrends.map((t) => t.trend),
            recommendedSkills: careerInsight.skillGaps
              .slice(0, 5)
              .map((g) => g.skill),
            lastUpdated: new Date(),
            nextUpdated: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Create email preference
      await tx.emailPreference.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      // Create streak record
      await tx.streak.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      // Generate personalized learning path
      const learningPath = await recommendLearningPath(
        data.skills,
        data.targetRole || `Advance in ${data.industry}`,
        data.availableHoursPerWeek || 8,
        data.learningTimeline || "3 months"
      );

      // Find matching learning paths in database
      const industryPath = await tx.learningPath.findFirst({
        where: {
          isPublished: true,
          OR: [
            { industry: data.industry },
            { title: { contains: data.industry, mode: "insensitive" } },
          ],
        },
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: { lessons: { orderBy: { order: "asc" } } },
          },
        },
      });

      let enrolledPathId: string | null = null;
      let enrolledPathTitle = "Career Acceleration Program";

      if (industryPath) {
        enrolledPathId = industryPath.id;
        enrolledPathTitle = industryPath.title;

        const firstModule = industryPath.modules[0];
        const firstLesson = firstModule?.lessons[0];

        await tx.enrollment.upsert({
          where: {
            userId_learningPathId: {
              userId: user.id,
              learningPathId: industryPath.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            learningPathId: industryPath.id,
            currentModuleId: firstModule?.id,
            currentLessonId: firstLesson?.id,
            lastAccessedAt: new Date(),
          },
        });
      }

      // Also enroll in "Career Acceleration Program" if exists
      const careerPath = await tx.learningPath.findFirst({
        where: {
          isPublished: true,
          OR: [
            { title: { contains: "career", mode: "insensitive" } },
            { title: { contains: "acceleration", mode: "insensitive" } },
          ],
        },
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: { lessons: { orderBy: { order: "asc" } } },
          },
        },
      });

      if (careerPath && careerPath.id !== industryPath?.id) {
        const firstModule = careerPath.modules[0];
        const firstLesson = firstModule?.lessons[0];

        await tx.enrollment.upsert({
          where: {
            userId_learningPathId: {
              userId: user.id,
              learningPathId: careerPath.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            learningPathId: careerPath.id,
            currentModuleId: firstModule?.id,
            currentLessonId: firstLesson?.id,
            lastAccessedAt: new Date(),
          },
        });
      }

      return {
        updatedUser,
        careerInsight,
        learningPath,
        enrolledPathId,
        enrolledPathTitle,
        skillGaps: careerInsight.skillGaps,
        recommendedActions: careerInsight.recommendedActions,
      };
    }, { timeout: 30000 });

    revalidatePath("/dashboard");
    revalidatePath("/academy");

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error completing onboarding:", error);
    throw new Error("Failed to complete onboarding");
  }
}

export async function getAIOnboardingRecommendations(industry: string, skills: string[]) {
  try {
    const careerInsight = await analyzeCareerProfile({
      industry,
      experience: 0,
      skills,
      bio: "",
    });

    return {
      skillGaps: careerInsight.skillGaps,
      careerPaths: careerInsight.careerPathSuggestions,
      marketTrends: careerInsight.marketTrends,
    };
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return null;
  }
}
