import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import type { SessionStatus } from "@prisma/client";

// Cancel or complete a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, rating, feedback } = body;

    const allowedStatuses: SessionStatus[] = [
      "SCHEDULED",
      "COMPLETED",
      "CANCELLED",
      "RESCHEDULED",
    ];

    if (!allowedStatuses.includes(status as SessionStatus)) {
      return NextResponse.json({ error: "Invalid session status" }, { status: 400 });
    }

    const nextStatus = status as SessionStatus;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await db.mentorshipSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Only mentor or student can update
    if (session.mentorId !== user.id && session.studentId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    const updateData: {
      status: SessionStatus;
      rating?: number | null;
      feedback?: string | null;
    } = { status: nextStatus };

    // If completing and rating provided (student rates mentor)
    if (nextStatus === "COMPLETED" && rating && session.mentorId === user.id) {
      updateData.rating = rating;
      updateData.feedback = feedback;

      // Update mentor stats
      const mentor = await db.mentor.findUnique({
        where: { id: session.mentorId },
      });

      if (mentor) {
        const newTotalSessions = mentor.totalSessions + 1;
        const newRating =
          ((mentor.rating || 0) * mentor.totalSessions + rating) /
          newTotalSessions;

        await db.mentor.update({
          where: { id: session.mentorId },
          data: {
            totalSessions: newTotalSessions,
            rating: newRating,
          },
        });
      }
    }

    const updatedSession = await db.mentorshipSession.update({
      where: { id },
      data: updateData,
      include: {
        mentor: {
          include: {
            user: { select: { name: true, imageUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const session = await db.mentorshipSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Only mentor or student can cancel
    if (session.mentorId !== user.id && session.studentId !== user.id) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    await db.mentorshipSession.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling session:", error);
    return NextResponse.json(
      { error: "Failed to cancel session" },
      { status: 500 }
    );
  }
}
