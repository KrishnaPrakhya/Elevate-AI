"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateAIinsights } from "./dashboard";
import { getCachedData,invalidateCachePattern,CACHE_TTL } from "@/lib/redis";
import { revalidatePath } from "next/cache";

interface UpdateUserData {
  industry: string;
  experience: string;
  bio: string;
  skills: string[];
}

export async function getUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await getCachedData(
    `user:profile:${userId}`,
    () =>
      db.user.findUnique({
        where: {
          clerkUserId: userId
        }
      }),
    CACHE_TTL.SHORT
  );

  if (!user) throw new Error("User Not Found");
  return user;
}

interface UpdateUserProfileData {
  industry?: string;
  targetRole?: string;
  skills?: string[];
  bio?: string;
  experience?: number;
}

export async function getUserProfile() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return getCachedData(
    `user:profile:${userId}`,
    () =>
      db.user.findUnique({
        where: { clerkUserId: userId },
        select: {
          id: true,
          name: true,
          email: true,
          industry: true,
          targetRole: true,
          experience: true,
          skills: true,
          bio: true,
        },
      }),
    CACHE_TTL.SHORT
  );
}

export async function updateUserProfile(data: UpdateUserProfileData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        ...(data.industry && { industry: data.industry }),
        ...(data.targetRole && { targetRole: data.targetRole }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.experience !== undefined && { experience: data.experience }),
      },
    });

    await invalidateCachePattern(`user:profile:${userId}`);
    await invalidateCachePattern(`dashboard:*:${user.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/academy");

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Failed to update user profile:", error);
    throw new Error("Internal Server Error");
  }
}

export async function updateUser(data: UpdateUserData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId
    }
  });

  if (!user) {
    throw new Error("User Not Found");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      let industryInsight = await tx.industryInsight.findUnique({
        where: {
          industry: data.industry
        }
      });

      if (!industryInsight) {
           const insights = await generateAIinsights(data.industry, "IN");
            console.log(insights)
           industryInsight=await db.industryInsight.create({
             data:{
               ...insights,
                industry:data.industry,
               salaryRanges: insights.salaryRanges.map(range => ({
                 role: range.role,
                 min: range.min,
                 max: range.max,
                 median: range.median,
                 location: range.location
               })),
               nextUpdated:new Date(Date.now()+7*24*60*60*1000)
             }
           })
      }

      const updatedUser = await tx.user.update({
        where: {
          id: user.id
        },
        data: {
          industry: data.industry,
          targetRole: null, // Will be set separately if provided
          experience: Number(data.experience),
          bio: data.bio,
          skills: data.skills
        }
      });

      // Create email preference for academy features
      await tx.emailPreference.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id }
      });

      // Create streak record for the user
      await tx.streak.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id }
      });

      // Auto-enroll user in industry-specific learning path (if available)
      const industryPath = await tx.learningPath.findFirst({
        where: {
          isPublished: true,
          OR: [
            { industry: data.industry },
            { title: { contains: data.industry, mode: "insensitive" } }
          ]
        }
      });

      if (industryPath) {
        // Get first module and lesson
        const modules = await tx.module.findMany({
          where: { learningPathId: industryPath.id },
          orderBy: { order: "asc" },
          take: 1,
          include: {
            lessons: {
              orderBy: { order: "asc" },
              take: 1
            }
          }
        });

        const firstModule = modules[0];
        const firstLesson = firstModule?.lessons[0];

        // Create enrollment if not already enrolled
        await tx.enrollment.upsert({
          where: {
            userId_learningPathId: {
              userId: user.id,
              learningPathId: industryPath.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            learningPathId: industryPath.id,
            currentModuleId: firstModule?.id,
            currentLessonId: firstLesson?.id,
            lastAccessedAt: new Date()
          }
        });
      }

      // Auto-enroll in "Career Acceleration Program" if exists
      const careerPath = await tx.learningPath.findFirst({
        where: {
          isPublished: true,
          OR: [
            { title: { contains: "career", mode: "insensitive" } },
            { title: { contains: "acceleration", mode: "insensitive" } }
          ]
        }
      });

      if (careerPath) {
        const modules = await tx.module.findMany({
          where: { learningPathId: careerPath.id },
          orderBy: { order: "asc" },
          take: 1,
          include: {
            lessons: {
              orderBy: { order: "asc" },
              take: 1
            }
          }
        });

        const firstModule = modules[0];
        const firstLesson = firstModule?.lessons[0];

        await tx.enrollment.upsert({
          where: {
            userId_learningPathId: {
              userId: user.id,
              learningPathId: careerPath.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            learningPathId: careerPath.id,
            currentModuleId: firstModule?.id,
            currentLessonId: firstLesson?.id,
            lastAccessedAt: new Date()
          }
        });
      }

      return { updatedUser, industryInsight };
    }, {
      timeout: 10000
    });
    await invalidateCachePattern(`*:${user.id}*`)
    await invalidateCachePattern(`user:*:${userId}`)
    await invalidateCachePattern(`dashboard:*:${user.id}`)
    revalidatePath("/dashboard")
    return {success:true,...result};
  } catch (error) {
    console.error("Failed to update user:", error);
    throw new Error("Internal Server Error");
  }
}


export async function getOnboardingStatus(){
  const {userId}=await auth();
  if(!userId) throw new Error("Unauthorized");
  try {
    const user=await getCachedData(
      `user:onboarding:${userId}`,
      () =>
        db.user.findUnique({
          where:{
            clerkUserId:userId
          },
          select:{
            industry:true
          }
        }),
      CACHE_TTL.SHORT
    )
    const isOnBoardingStatus=user?.industry?true:false
    return {isOnBoardingStatus}
  } catch (error) {
    console.log(error)
    throw new Error("Error Fetching Onboarding Status")
    
  }
}