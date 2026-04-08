import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mentorId = searchParams.get("mentorId");
    const status = searchParams.get("status");

    if (mentorId) {
      // Get available sessions for a specific mentor
      const sessions = await db.mentorshipSession.findMany({
        where: {
          mentorId,
          status: status ? (status as "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED") : "SCHEDULED",
        },
        include: {
          mentor: {
            include: {
              user: {
                select: { name: true, imageUrl: true },
              },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });
      return NextResponse.json({ sessions });
    }

    // Get user's sessions (as student or mentor)
    const isMentor = await db.mentor.findUnique({
      where: { userId: user.id },
    });

    const where = isMentor
      ? { mentorId: user.id }
      : { studentId: user.id };

    const sessions = await db.mentorshipSession.findMany({
      where,
      include: {
        mentor: {
          include: {
            user: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: { scheduledAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error loading mentorship sessions:", error);
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mentorId, scheduledAt, durationMinutes = 30 } = body;

    if (!mentorId || !scheduledAt) {
      return NextResponse.json(
        { error: "Mentor ID and scheduled time are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if mentor exists
    const mentor = await db.mentor.findUnique({
      where: { id: mentorId },
    });

    if (!mentor) {
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }

    if (!mentor.isAvailable) {
      return NextResponse.json(
        { error: "Mentor is not available" },
        { status: 400 }
      );
    }

    // Check for conflicting sessions
    const conflict = await db.mentorshipSession.findFirst({
      where: {
        mentorId,
        scheduledAt: new Date(scheduledAt),
        status: { in: ["SCHEDULED", "COMPLETED"] },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "Time slot already booked" },
        { status: 400 }
      );
    }

    const session = await db.mentorshipSession.create({
      data: {
        mentorId,
        studentId: user.id,
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        status: "SCHEDULED",
      },
      include: {
        mentor: {
          include: {
            user: { select: { name: true, imageUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error booking mentorship session:", error);
    return NextResponse.json(
      { error: "Failed to book session" },
      { status: 500 }
    );
  }
}
