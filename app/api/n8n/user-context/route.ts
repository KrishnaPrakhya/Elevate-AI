import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Called by n8n to fetch user profile before running a job search.
// Authenticated via shared secret (not Clerk — this is server-to-server).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
  const clerkUserId = searchParams.get("clerkUserId");

  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!clerkUserId) {
    return NextResponse.json({ error: "Missing clerkUserId" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      targetRole: true,
      skills: true,
      experience: true,
      industry: true,
      careerPlans: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { planDetails: true, targetRole: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const activePlan = user.careerPlans[0];
  const planDetails = activePlan?.planDetails as Record<string, unknown> | null;
  const topGaps: string[] = Array.isArray(planDetails?.topGaps)
    ? (planDetails.topGaps as { skill?: string }[])
        .map((g) => (typeof g === "string" ? g : g?.skill ?? ""))
        .filter(Boolean)
    : [];

  const targetRole = activePlan?.targetRole ?? user.targetRole ?? "";

  // Derive searchable keyword list from role + skills + gaps
  const searchKeywords = Array.from(
    new Set([
      ...(targetRole ? [targetRole] : []),
      ...(user.skills ?? []),
      ...topGaps,
    ])
  ).filter(Boolean);

  return NextResponse.json({
    clerkUserId,
    targetRole,
    skills: user.skills ?? [],
    experience: user.experience ?? 0,
    industry: user.industry ?? "",
    careerPlanGaps: topGaps,
    searchKeywords,
  });
}
