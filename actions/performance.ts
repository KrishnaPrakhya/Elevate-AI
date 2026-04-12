"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { CACHE_TTL, getCachedData } from "@/lib/redis";
import { computePerformanceIntelligence } from "@/lib/performance/intelligence";

export async function getPerformanceIntelligence() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      targetRole: true,
    },
  });

  if (!user) throw new Error("User not found");

  const todayBucket = new Date().toISOString().slice(0, 10);
  const cacheKey = `performance:intelligence:${user.id}:${todayBucket}`;

  return getCachedData(
    cacheKey,
    () =>
      computePerformanceIntelligence({
        userId: user.id,
        targetRole: user.targetRole,
      }),
    CACHE_TTL.SHORT
  );
}