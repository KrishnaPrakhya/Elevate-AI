"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateAIinsights } from "./dashboard";
import { getCachedData,invalidateCachePattern,CACHE_TTL } from "@/lib/redis";


interface UpdateUserData {
  industry: string;
  experience: string;
  bio: string;
  skills: string[];
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
           const insights = await generateAIinsights(data.industry);
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
          experience: Number(data.experience),
          bio: data.bio,
          skills: data.skills
        }
      });

      return { updatedUser, industryInsight };
    }, {
      timeout: 10000
    });
    await invalidateCachePattern(`*:${user.id}*`)
    return {success:true,...result};
  } catch (error) {
    console.error("Failed to update user:", error);
    throw new Error("Internal Server Error");
  }
}


export async function getOnboardingStatus(){
  const {userId}=await auth();
  if(!userId) throw new Error("Unauthorized");
  return getCachedData(
    `onboarding:status:${userId}`,
    async () => {
  try {
    const user=await db.user.findUnique({
      where:{
        clerkUserId:userId
      },
      select:{
        industry:true
      }
    })
    const isOnBoardingStatus=user?.industry?true:false
    return {isOnBoardingStatus}
  } catch (error) {
    console.log(error)
    throw new Error("Error Fetching Onboarding Status")
    
  }
},CACHE_TTL.SHORT)
}