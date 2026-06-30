import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL is not configured" },
      { status: 503 }
    );
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
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

  const payload = {
    clerkUserId: userId,
    targetRole: activePlan?.targetRole ?? user.targetRole ?? "",
    skills: user.skills ?? [],
    experience: user.experience ?? 0,
    industry: user.industry ?? "",
    careerPlanGaps: topGaps,
    // N8N_APP_BASE_URL lets Docker-hosted n8n reach the host machine.
    // Set to http://host.docker.internal:3000 when n8n runs in Docker locally.
    // Falls back to NEXT_PUBLIC_APP_URL for production / non-Docker setups.
    callbackUrl: `${process.env.N8N_APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://elevate-ai-snowy.vercel.app"}/api/webhooks/n8n/job-results`,
    secret: process.env.N8N_WEBHOOK_SECRET ?? "",
    // Pass Tavily key so n8n can call the search API without storing credentials there.
    tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
  };

  try {
    const res = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("n8n trigger failed:", res.status, text);
      return NextResponse.json(
        { error: "n8n workflow trigger failed", detail: text.slice(0, 200) },
        { status: 502 }
      );
    }

    return NextResponse.json({ triggered: true });
  } catch (err) {
    console.error("n8n trigger error:", err);
    return NextResponse.json(
      { error: "Could not reach n8n workflow" },
      { status: 502 }
    );
  }
}
