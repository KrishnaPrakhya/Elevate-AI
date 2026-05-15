"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { CACHE_TTL, getCachedData, invalidateCache } from "@/lib/redis";
import { analyzeCareerProfile } from "@/lib/ai/career-agent";
import { inngest } from "@/lib/inngest/client";

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
    const parsedExperience = parseInt(data.experience);

    // Pre-fetch / ensure all read-heavy + conditional data OUTSIDE the transaction
    const [industryPath, careerPath] = await Promise.all([
      db.learningPath.findFirst({
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
      }),
      db.learningPath.findFirst({
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
      }),
    ]);

    // Ensure IndustryInsight row exists BEFORE the transaction (FK dependency)
    await db.industryInsight.upsert({
      where: { industry: data.industry },
      update: {},
      create: {
        industry: data.industry,
        topSkills: [],
        growthRate: 5.0,
        demandLevel: "HIGH",
        marketOutLook: "POSITIVE",
        keyTrends: [],
        recommendedSkills: [],
        lastUpdated: new Date(),
        nextUpdated: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Transaction: only pure writes — no reads, no conditional creates
    await db.$transaction(
      async (tx) => {
        // 1. Update user profile (FK satisfied above)
        await tx.user.update({
          where: { id: user.id },
          data: {
            industry: data.industry,
            targetRole: data.targetRole || null,
            experience: parsedExperience,
            bio: data.bio,
            skills: data.skills,
          },
        });

        // 2. Bootstrap email preference and streak
        await Promise.all([
          tx.emailPreference.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          }),
          tx.streak.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id },
          }),
        ]);

        // 3. Enroll in pre-fetched learning paths
        const enrollOps = [];

        if (industryPath) {
          const firstModule = industryPath.modules[0];
          const firstLesson = firstModule?.lessons[0];
          enrollOps.push(
            tx.enrollment.upsert({
              where: { userId_learningPathId: { userId: user.id, learningPathId: industryPath.id } },
              update: {},
              create: {
                userId: user.id,
                learningPathId: industryPath.id,
                currentModuleId: firstModule?.id,
                currentLessonId: firstLesson?.id,
                lastAccessedAt: new Date(),
              },
            })
          );
        }

        if (careerPath && careerPath.id !== industryPath?.id) {
          const firstModule = careerPath.modules[0];
          const firstLesson = firstModule?.lessons[0];
          enrollOps.push(
            tx.enrollment.upsert({
              where: { userId_learningPathId: { userId: user.id, learningPathId: careerPath.id } },
              update: {},
              create: {
                userId: user.id,
                learningPathId: careerPath.id,
                currentModuleId: firstModule?.id,
                currentLessonId: firstLesson?.id,
                lastAccessedAt: new Date(),
              },
            })
          );
        }

        if (enrollOps.length > 0) await Promise.all(enrollOps);
      },
      { timeout: 15000 }
    );

    // Fire background AI job — non-blocking, never fails onboarding
    inngest.send({
      name: "onboarding/ai.requested",
      data: {
        industry: data.industry,
        experience: parsedExperience,
        skills: data.skills,
        bio: data.bio,
        targetRole: data.targetRole,
        careerGoals: data.careerGoals,
      },
    }).catch((err: unknown) => {
      console.warn("Inngest background job failed to queue (non-fatal):", err);
    });

    await invalidateCache(`user:onboarding:${userId}`);

    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    revalidatePath("/academy");

    return { success: true };
  } catch (error) {
    console.error("Error completing onboarding:", error);
    throw new Error("Failed to complete onboarding");
  }
}

export async function getAIOnboardingRecommendations(industry: string, skills: string[]) {
  const cacheKey = `onboarding:recommendations:${industry.toLowerCase()}:${Buffer.from(skills.map((s) => s.trim().toLowerCase()).sort().join(",")).toString("base64").slice(0, 32)}`;

  return getCachedData(
    cacheKey,
    async () => {
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
    },
    CACHE_TTL.MEDIUM
  );
}
