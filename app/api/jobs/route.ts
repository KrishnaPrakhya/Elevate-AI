import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const validStatus =
      statusParam && Object.values(ApplicationStatus).includes(statusParam as ApplicationStatus)
        ? (statusParam as ApplicationStatus)
        : undefined;

    const jobs = await db.jobApplication.findMany({
      where: {
        userId: user.id,
        ...(validStatus ? { status: validStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, appliedAt, followUpDate } = body;
    if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const job = await db.jobApplication.findFirst({ where: { id, userId: user.id } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.jobApplication.update({
      where: { id },
      data: {
        ...(status ? { status: status as ApplicationStatus } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(appliedAt ? { appliedAt: new Date(appliedAt) } : {}),
        ...(followUpDate !== undefined
          ? { followUpDate: followUpDate ? new Date(followUpDate) : null }
          : {}),
      },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const job = await db.jobApplication.findFirst({ where: { id, userId: user.id } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.jobApplication.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Failed to delete job" },
      { status: 500 }
    );
  }
}
