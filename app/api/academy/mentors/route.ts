import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const industry = searchParams.get("industry");

    const mentors = await db.mentor.findMany({
      where: {
        isAvailable: true,
        ...(industry && { expertise: { has: industry } }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
            bio: true,
            skills: true,
          },
        },
        sessions: {
          where: { status: "COMPLETED" },
          select: { rating: true },
        },
      },
      orderBy: { rating: "desc" },
    });

    // Calculate average rating and total sessions
    const mentorsWithStats = mentors.map((mentor) => ({
      id: mentor.id,
      userId: mentor.userId,
      bio: mentor.bio,
      expertise: mentor.expertise,
      yearsExperience: mentor.yearsExperience,
      rating: mentor.rating || 0,
      totalSessions: mentor.totalSessions,
      isAvailable: mentor.isAvailable,
      user: mentor.user,
      completedSessions: mentor.sessions.length,
      averageRating:
        mentor.sessions.length > 0
          ? mentor.sessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
            mentor.sessions.length
          : 0,
    }));

    return NextResponse.json({ mentors: mentorsWithStats });
  } catch (error) {
    console.error("Error loading mentors:", error);
    return NextResponse.json(
      { error: "Failed to load mentors" },
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
    const { bio, expertise, yearsExperience } = body;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a mentor
    const existingMentor = await db.mentor.findUnique({
      where: { userId: user.id },
    });

    if (existingMentor) {
      return NextResponse.json(
        { error: "Already registered as mentor" },
        { status: 400 }
      );
    }

    const mentor = await db.mentor.create({
      data: {
        userId: user.id,
        bio: bio || user.bio,
        expertise: expertise || user.skills || [],
        yearsExperience: yearsExperience || user.experience || 0,
        isAvailable: true,
      },
    });

    return NextResponse.json({ mentor });
  } catch (error) {
    console.error("Error registering as mentor:", error);
    return NextResponse.json(
      { error: "Failed to register as mentor" },
      { status: 500 }
    );
  }
}
