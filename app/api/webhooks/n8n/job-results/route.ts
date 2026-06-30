import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface IncomingJob {
  company: string;
  role: string;
  jobUrl: string;
  description?: string;
  location?: string;
  salaryRange?: string;
  remote?: boolean;
  matchScore?: number;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  const expected = process.env.N8N_WEBHOOK_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { clerkUserId: string; jobs: IncomingJob[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clerkUserId, jobs } = body;
  if (!clerkUserId || !Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ error: "Missing clerkUserId or jobs" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let saved = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (!job.company || !job.role || !job.jobUrl) {
      skipped++;
      continue;
    }

    const existing = await db.jobApplication.findFirst({
      where: { userId: user.id, jobUrl: job.jobUrl },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await db.jobApplication.create({
      data: {
        userId: user.id,
        company: job.company,
        role: job.role,
        jobUrl: job.jobUrl,
        description: job.description,
        location: job.location,
        salaryRange: job.salaryRange,
        remote: job.remote ?? false,
        status: "TRACKING",
        metadata: {
          matchScore: job.matchScore ?? null,
          source: "n8n",
          foundAt: new Date().toISOString(),
        },
      },
    });
    saved++;
  }

  return NextResponse.json({ saved, skipped });
}
