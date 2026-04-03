"use server";

import { db } from "@/lib/prisma";
import { checkUser } from "@/lib/checkUser";
import { CACHE_TTL, getCachedData } from "@/lib/redis";

// Note: Simulation feature removed - use career planner API (/api/career-planner) instead
// The career planner provides personalized learning paths with skill gap analysis

export async function getSkillGraph() {
  const user = await checkUser();
  if (!user) throw new Error("Unauthorized");
  
  const skillProgress = await getCachedData(
    `aiQuest:skillGraph:${user.id}`,
    () =>
      db.userSkillProgress.findMany({
        where: { userId: user.id },
        include: { skill: true }
      }),
    CACHE_TTL.SHORT
  );

  return skillProgress;
}
