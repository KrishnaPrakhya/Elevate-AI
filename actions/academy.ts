"use server";

import { db } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { inngest } from "@/lib/inngest/client";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

// ============================================
// ENROLLMENT & LEARNING PATH
// ============================================

export async function getLearningPaths(industry?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const where = industry
    ? { isPublished: true, OR: [{ industry: null }, { industry }] }
    : { isPublished: true };

  return db.learningPath.findMany({
    where,
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
        },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLearningPath(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.learningPath.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
          assignments: true,
        },
      },
    },
  });
}

export async function enrollInPath(learningPathId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  // Get the first module and lesson
  const path = await db.learningPath.findUnique({
    where: { id: learningPathId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!path) throw new Error("Learning path not found");

  const firstModule = path.modules[0];
  const firstLesson = firstModule?.lessons[0];

  const enrollment = await db.enrollment.create({
    data: {
      userId: user.id,
      learningPathId,
      currentModuleId: firstModule?.id,
      currentLessonId: firstLesson?.id,
      lastAccessedAt: new Date(),
    },
  });

  // Trigger enrollment email via Inngest
  await inngest.send({
    name: "academy/enrollment",
    data: {
      userId: user.id,
      learningPathId,
      enrollmentId: enrollment.id,
    },
  });

  revalidatePath("/academy");
  return enrollment;
}

export async function getUserEnrollments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return db.enrollment.findMany({
    where: { userId: user.id },
    include: {
      learningPath: {
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: {
              lessons: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { lastAccessedAt: "desc" },
  });
}

// ============================================
// LESSON PROGRESS
// ============================================

export async function updateLessonProgress(
  enrollmentId: string,
  lessonId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "REVIEW",
  timeSpentMinutes?: number
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const progress = await db.lessonProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId },
    },
    update: {
      status,
      timeSpentMinutes: timeSpentMinutes
        ? { increment: timeSpentMinutes }
        : undefined,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
    create: {
      enrollmentId,
      lessonId,
      status,
      timeSpentMinutes: timeSpentMinutes || 0,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });

  // Update enrollment progress
  await updateEnrollmentProgress(enrollmentId);

  // Check for achievements
  if (status === "COMPLETED") {
    await inngest.send({
      name: "academy/lesson-completed",
      data: { userId, enrollmentId, lessonId },
    });
  }

  revalidatePath("/academy");
  return progress;
}

async function updateEnrollmentProgress(enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      learningPath: {
        include: { modules: { include: { lessons: true } } },
      },
    },
  });

  if (!enrollment) return;

  const totalLessons = enrollment.learningPath.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0
  );

  const completedProgress = await db.lessonProgress.count({
    where: {
      enrollmentId,
      status: "COMPLETED",
    },
  });

  const progressPercent = totalLessons > 0
    ? (completedProgress / totalLessons) * 100
    : 0;

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progress: progressPercent,
      completedAt: progressPercent >= 100 ? new Date() : undefined,
    },
  });
}

export async function getLessonProgress(enrollmentId: string) {
  return db.lessonProgress.findMany({
    where: { enrollmentId },
    include: { lesson: true },
  });
}

// ============================================
// DAILY GOALS & STREAKS
// ============================================

export async function getTodayGoal() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db.dailyGoal.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
}

export async function updateDailyGoal(data: {
  actualMinutes?: number;
  lessonsCompleted?: number;
  assignmentsCompleted?: number;
  quizzesCompleted?: number;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const goal = await db.dailyGoal.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: data,
    create: {
      userId: user.id,
      date: today,
      ...data,
    },
  });

  // Update streak
  await updateStreak(user.id);

  // Trigger daily goal completion email if target reached
  if (goal.actualMinutes >= goal.targetMinutes) {
    await inngest.send({
      name: "academy/daily-goal-completed",
      data: { userId: user.id, goalId: goal.id },
    });
  }

  revalidatePath("/academy");
  return goal;
}

async function updateStreak(userId: string) {
  const streak = await db.streak.findUnique({ where: { userId } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!streak) {
    await db.streak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
        totalDaysActive: 1,
      },
    });
    return;
  }

  const lastActivity = streak.lastActivityDate;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = streak.currentStreak;

  if (lastActivity && lastActivity.toDateString() === yesterday.toDateString()) {
    newStreak = streak.currentStreak + 1;
  } else if (lastActivity && lastActivity.toDateString() !== today.toDateString()) {
    newStreak = 1;
  }

  await db.streak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(streak.longestStreak, newStreak),
      lastActivityDate: today,
      totalDaysActive: { increment: 1 },
    },
  });
}

export async function getUserStreak() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return db.streak.findUnique({ where: { userId: user.id } });
}

// ============================================
// ASSIGNMENTS & SUBMISSIONS
// ============================================

export async function getAssignment(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.assignment.findUnique({
    where: { id },
    include: { submissions: { orderBy: { submittedAt: "desc" } } },
  });
}

export async function submitAssignment(
  assignmentId: string,
  lessonId: string | null,
  content: string,
  attachments?: Prisma.JsonValue
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new Error("Assignment not found");

  const isLate = assignment.dueDate ? new Date() > assignment.dueDate : false;

  const submissionData: {
    assignmentId: string;
    lessonId: string | null;
    userId: string;
    content: string;
    isLate: boolean;
    attachments?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  } = {
    assignmentId,
    lessonId,
    userId: user.id,
    content,
    isLate: assignment.allowLateSubmission ? isLate : false,
  };

  if (attachments !== undefined) {
    submissionData.attachments = attachments === null ? Prisma.JsonNull : (attachments as Prisma.InputJsonValue);
  }

  const submission = await db.submission.create({
    data: submissionData,
  });

  // Trigger submission email to mentor if assigned
  await inngest.send({
    name: "academy/assignment-submitted",
    data: { userId: user.id, submissionId: submission.id },
  });

  revalidatePath("/academy");
  return submission;
}

export async function gradeSubmission(
  submissionId: string,
  score: number,
  feedback: string
) {
  const submission = await db.submission.update({
    where: { id: submissionId },
    data: { score, feedback, gradedAt: new Date() },
  });

  // Award achievement if passed
  if (submission && score >= 60) {
    await inngest.send({
      name: "academy/assignment-graded",
      data: { submissionId, score },
    });
  }

  revalidatePath("/academy");
  return submission;
}

export async function getUserSubmissions() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return db.submission.findMany({
    where: { userId: user.id },
    include: { assignment: true },
    orderBy: { submittedAt: "desc" },
  });
}

// ============================================
// ACHIEVEMENTS & LEADERBOARD
// ============================================

export async function getAchievements() {
  return db.achievement.findMany({
    where: { isActive: true },
    orderBy: { points: "desc" },
  });
}

export async function getUserAchievements() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  return db.userAchievement.findMany({
    where: { userId: user.id },
    include: { achievement: true },
    orderBy: { earnedAt: "desc" },
  });
}

export async function checkAndAwardAchievements(userId: string, type: string) {
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) return;

  const achievements = await db.achievement.findMany({
    where: { category: type as any, isActive: true },
  });

  for (const achievement of achievements) {
    const existing = await db.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
    });

    if (existing) continue;

    const criteria = achievement.criteria as any;
    let earned = false;

    switch (type) {
      case "LEARNING":
        const lessonsCompleted = await db.lessonProgress.count({
          where: { enrollment: { userId: user.id }, status: "COMPLETED" },
        });
        earned = lessonsCompleted >= criteria.threshold;
        break;
      case "STREAK":
        const streak = await db.streak.findUnique({ where: { userId: user.id } });
        earned = !!streak && streak.currentStreak >= criteria.threshold;
        break;
      case "ASSIGNMENT":
        const submissions = await db.submission.count({
          where: { userId: user.id, score: { gte: criteria.minScore || 60 } },
        });
        earned = submissions >= criteria.threshold;
        break;
      case "QUIZ":
        const quizCount = await db.assessments.count({
          where: { userId: user.id },
        });
        earned = quizCount >= criteria.threshold;
        break;
    }

    if (earned) {
      await db.userAchievement.create({
        data: { userId: user.id, achievementId: achievement.id },
      });

      await inngest.send({
        name: "academy/achievement-unlocked",
        data: { userId: user.id, achievementId: achievement.id },
      });
    }
  }
}

export async function getLeaderboard(
  type: "WEEKLY" | "MONTHLY" | "ALL_TIME" = "WEEKLY"
) {
  const now = new Date();
  let startDate: Date;

  switch (type) {
    case "WEEKLY":
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case "MONTHLY":
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "ALL_TIME":
      startDate = new Date(0);
      break;
  }

  const leaderboard = await db.leaderboard.findFirst({
    where: {
      type,
      startDate: { gte: startDate },
    },
    include: {
      entries: {
        orderBy: { rank: "asc" },
        take: 50,
      },
    },
  });

  return leaderboard;
}

// ============================================
// COHORTS & MENTORSHIP
// ============================================

export async function getCohorts() {
  return db.cohort.findMany({
    where: { isActive: true },
    include: {
      members: { take: 5 },
      _count: { select: { members: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function joinCohort(cohortId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const cohort = await db.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new Error("Cohort not found");

  const memberCount = await db.cohortMember.count({ where: { cohortId } });
  if (memberCount >= cohort.maxMembers) {
    throw new Error("Cohort is full");
  }

  const member = await db.cohortMember.create({
    data: { cohortId, userId: user.id },
  });

  await inngest.send({
    name: "academy/cohort-joined",
    data: { userId: user.id, cohortId },
  });

  revalidatePath("/academy/cohorts");
  return member;
}

export async function getUserCohort() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const membership = await db.cohortMember.findFirst({
    where: { userId: user.id },
    include: {
      cohort: {
        include: {
          members: { include: { user: true } },
        },
      },
    },
  });

  return membership?.cohort || null;
}

export async function scheduleMentorshipSession(
  mentorId: string,
  scheduledAt: Date,
  durationMinutes: number = 30,
  notes?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const session = await db.mentorshipSession.create({
    data: {
      mentorId,
      studentId: user.id,
      scheduledAt,
      durationMinutes,
      notes,
    },
  });

  await inngest.send({
    name: "academy/mentorship-scheduled",
    data: { userId: user.id, sessionId: session.id },
  });

  revalidatePath("/academy/mentorship");
  return session;
}

export async function getMentors() {
  return db.mentor.findMany({
    where: { isAvailable: true },
    orderBy: { rating: "desc" },
  });
}

// ============================================
// ACADEMY DASHBOARD
// ============================================

export async function getAcademyDashboard() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const [enrollments, streak, todayGoal, achievements, submissions] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.id },
      include: {
        learningPath: {
          include: { modules: { include: { lessons: true } } },
        },
      },
    }),
    db.streak.findUnique({ where: { userId: user.id } }),
    db.dailyGoal.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    db.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
    }),
    db.submission.findMany({
      where: { userId: user.id },
      include: { assignment: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
  ]);

  // Calculate stats
  const totalLessonsCompleted = await db.lessonProgress.count({
    where: {
      enrollment: { userId: user.id },
      status: "COMPLETED",
    },
  });

  const totalAssignmentsCompleted = submissions.filter((s) => s.score !== null).length;
  const totalPoints = achievements.reduce((acc, ua) => acc + ua.achievement.points, 0);

  return {
    enrollments,
    streak,
    todayGoal,
    achievements,
    recentSubmissions: submissions,
    stats: {
      totalLessonsCompleted,
      totalAssignmentsCompleted,
      totalPoints,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      weeklyGoalProgress: todayGoal
        ? (todayGoal.actualMinutes / todayGoal.targetMinutes) * 100
        : 0,
    },
  };
}

// ============================================
// AI-POWERED PERSONALIZED LEARNING
// ============================================

export async function getPersonalizedRecommendations() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
      enrollments: {
        include: {
          learningPath: {
            include: {
              modules: {
                include: { lessons: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) throw new Error("User not found");

  // Get incomplete enrollments
  const inProgressEnrollments = user.enrollments.filter((e) => e.progress < 100);

  // Get available paths not enrolled in
  const enrolledPathIds = user.enrollments.map((e) => e.learningPathId);
  const recommendedPaths = await db.learningPath.findMany({
    where: {
      isPublished: true,
      id: { notIn: enrolledPathIds },
      OR: [{ industry: user.industry }, { industry: null }],
    },
    take: 3,
  });

  // Get next lessons to complete
  const nextLessons = inProgressEnrollments.map((enrollment) => {
    const path = enrollment.learningPath;
    const currentModule = path.modules.find((m) => m.id === enrollment.currentModuleId);
    const currentLesson = currentModule?.lessons.find((l) => l.id === enrollment.currentLessonId);
    return { enrollment, currentModule, currentLesson };
  });

  // Generate AI tips based on user's industry and progress
  let aiTip = "";
  if (model && user.industryInsight) {
    try {
      const prompt = `Based on a ${user.industry} professional with ${user.experience} years of experience,
        who has completed ${user.enrollments.reduce((acc, e) => acc + e.progress, 0) / user.enrollments.length || 0}% average progress,
        generate a single, actionable learning tip. Keep it under 2 sentences.`;
      const result = await model.chat.completions.create({
        model: "minimax-m2.7",
        messages: [{ role: "user", content: prompt }],
      });
      aiTip = result.choices[0]?.message?.content?.trim() || "";
    } catch (e) {
      console.error("Error generating AI tip:", e);
    }
  }

  return {
    recommendedPaths,
    nextLessons,
    aiTip,
  };
}