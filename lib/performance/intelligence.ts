import type { AIRecommendation } from "@/lib/ai/career-agent";
import { db } from "@/lib/prisma";
import { invalidateCachePattern } from "@/lib/redis";
import { ActionType, ExecutionStatus, Prisma } from "@prisma/client";

export type TrackedActionInput = {
  userId: string;
  type: ActionType;
  title: string;
  description: string;
  params?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  status?: ExecutionStatus;
  errorMessage?: string;
  metadata?: Prisma.InputJsonValue;
};

export type PerformanceActionHistoryItem = {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  status: ExecutionStatus;
  executedAt: string;
  whyThisWasSuggested: string;
};

export type PerformanceStats = {
  technicalQuizAverage: number | null;
  interviewSimulationAverage: number | null;
  technicalQuizAttempts14d: number;
  interviewSimulations14d: number;
  lessonsCompleted7d: number;
  activeEnrollments: number;
  operationsTracked7d: number;
};

export type PerformanceIntelligence = {
  stats: PerformanceStats;
  nextActions: AIRecommendation[];
  recentActions: PerformanceActionHistoryItem[];
  rationaleSummary: string[];
  weakAreas: string[];
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function toDateBefore(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asReason(action: {
  metadata: Prisma.JsonValue | null;
  description: string;
}) {
  if (!action.metadata || typeof action.metadata !== "object" || Array.isArray(action.metadata)) {
    return action.description;
  }

  const metadataRecord = action.metadata as Record<string, unknown>;
  const explicitReason = asString(metadataRecord.reason);
  return explicitReason || action.description;
}

export async function recordExecutedAction(input: TrackedActionInput): Promise<void> {
  try {
    await db.executedAction.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        params: input.params ?? {},
        result: input.result,
        status: input.status ?? ExecutionStatus.SUCCESS,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
      },
    });

    await invalidateCachePattern(`performance:intelligence:${input.userId}:*`);
  } catch (error) {
    console.error("Failed to record executed action:", error);
  }
}

function buildStatsBasedActions(params: {
  targetRole?: string | null;
  stats: PerformanceStats;
}): { nextActions: AIRecommendation[]; rationaleSummary: string[] } {
  const { targetRole, stats } = params;
  const nextActions: AIRecommendation[] = [];
  const rationaleSummary: string[] = [];

  const targetRoleLabel = targetRole || "your target role";

  if (
    stats.technicalQuizAttempts14d < 2 ||
    (stats.technicalQuizAverage !== null && stats.technicalQuizAverage < 75)
  ) {
    nextActions.push({
      type: "interview",
      title: "Schedule 2 technical quizzes this week",
      description:
        "Complete at least two quiz sessions in the Interview module to raise technical consistency.",
      priority: "high",
      reasoning:
        `Technical quiz signal is below target: attempts in 14d = ${stats.technicalQuizAttempts14d}` +
        `${stats.technicalQuizAverage !== null ? `, average score = ${stats.technicalQuizAverage}%` : ""}.`,
      actionUrl: "/interview",
      metadata: {
        cadence: "2 quizzes/week",
        triggerMetric: {
          attempts14d: stats.technicalQuizAttempts14d,
          technicalQuizAverage: stats.technicalQuizAverage,
        },
      },
    });
    rationaleSummary.push("Quiz cadence is below benchmark or quiz score trend is weak.");
  }

  if (
    stats.interviewSimulations14d < 1 ||
    (stats.interviewSimulationAverage !== null && stats.interviewSimulationAverage < 78)
  ) {
    nextActions.push({
      type: "interview",
      title: "Run 1 voice mock interview in the next 3 days",
      description:
        "Practice a full voice interview simulation and review communication feedback before your next quiz loop.",
      priority: "high",
      reasoning:
        `Voice interview signal is below target: simulations in 14d = ${stats.interviewSimulations14d}` +
        `${stats.interviewSimulationAverage !== null ? `, average score = ${stats.interviewSimulationAverage}%` : ""}.`,
      actionUrl: "/interview/simulator-live",
      metadata: {
        cadence: "1 simulation/3 days",
        triggerMetric: {
          simulations14d: stats.interviewSimulations14d,
          interviewSimulationAverage: stats.interviewSimulationAverage,
        },
      },
    });
    rationaleSummary.push("Voice interview practice volume/score is below the readiness threshold.");
  }

  if (stats.activeEnrollments > 0 && stats.lessonsCompleted7d < 3) {
    nextActions.push({
      type: "course",
      title: "Complete 3 lessons in Academy this week",
      description:
        `Strengthen learning-path momentum for ${targetRoleLabel} with focused lesson completion before the next interview cycle.`,
      priority: "medium",
      reasoning:
        `Lessons completed in 7d is ${stats.lessonsCompleted7d}, below the target cadence of 3 lessons/week while active enrollments exist (${stats.activeEnrollments}).`,
      actionUrl: "/academy",
      metadata: {
        cadence: "3 lessons/week",
        triggerMetric: {
          lessonsCompleted7d: stats.lessonsCompleted7d,
          activeEnrollments: stats.activeEnrollments,
        },
      },
    });
    rationaleSummary.push("Learning-path progress is lagging compared to planned weekly cadence.");
  }

  if (nextActions.length === 0) {
    nextActions.push({
      type: "skill",
      title: "Maintain current cadence and run a checkpoint review",
      description:
        "Performance metrics are healthy. Keep your current routine and do one review session to lock retention.",
      priority: "low",
      reasoning:
        "Recent assessment and activity metrics are within baseline targets for interview readiness.",
      actionUrl: "/dashboard",
      metadata: {
        cadence: "weekly checkpoint",
      },
    });
    rationaleSummary.push("Current statistics indicate stable progress; maintain cadence.");
  }

  return { nextActions, rationaleSummary };
}

export async function computePerformanceIntelligence(params: {
  userId: string;
  targetRole?: string | null;
}): Promise<PerformanceIntelligence> {
  const { userId, targetRole } = params;
  const last7Days = toDateBefore(7);
  const last14Days = toDateBefore(14);
  const last30Days = toDateBefore(30);

  const [
    assessments30d,
    recentActions,
    activeEnrollmentsCount,
    lessonsCompleted7dCount,
    operationsTracked7dCount,
  ] =
    await Promise.all([
      db.assessments.findMany({
        where: { userId, createdAt: { gte: last30Days } },
        select: {
          category: true,
          quizScore: true,
          createdAt: true,
        },
      }),
      db.executedAction.findMany({
        where: { userId },
        orderBy: { executedAt: "desc" },
        take: 15,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          executedAt: true,
          metadata: true,
        },
      }),
      db.enrollment.count({
        where: { userId, progress: { lt: 100 } },
      }),
      db.lessonProgress.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: last7Days },
          enrollment: { userId },
        },
      }),
      db.executedAction.count({
        where: {
          userId,
          executedAt: { gte: last7Days },
        },
      }),
    ]);

  const technicalAssessments = assessments30d.filter((assessment) => {
    const category = assessment.category.toLowerCase();
    return category.includes("technical") || category.includes("quiz");
  });

  const interviewSimAssessments = assessments30d.filter((assessment) => {
    const category = assessment.category.toLowerCase();
    return category.includes("interview simulation");
  });

  const technicalQuizAttempts14d = technicalAssessments.filter(
    (assessment) => assessment.createdAt >= last14Days
  ).length;

  const interviewSimulations14d = interviewSimAssessments.filter(
    (assessment) => assessment.createdAt >= last14Days
  ).length;

  const stats: PerformanceStats = {
    technicalQuizAverage: average(technicalAssessments.map((assessment) => assessment.quizScore)),
    interviewSimulationAverage: average(
      interviewSimAssessments.map((assessment) => assessment.quizScore)
    ),
    technicalQuizAttempts14d,
    interviewSimulations14d,
    lessonsCompleted7d: lessonsCompleted7dCount,
    activeEnrollments: activeEnrollmentsCount,
    operationsTracked7d: operationsTracked7dCount,
  };

  const { nextActions, rationaleSummary } = buildStatsBasedActions({ targetRole, stats });

  const weakAreas = Array.from(
    new Set(
      [
        stats.technicalQuizAverage !== null && stats.technicalQuizAverage < 75
          ? "technical fundamentals"
          : "",
        stats.interviewSimulationAverage !== null && stats.interviewSimulationAverage < 78
          ? "interview communication"
          : "",
        stats.technicalQuizAttempts14d < 2 ? "technical quiz cadence" : "",
        stats.interviewSimulations14d < 1 ? "mock interview cadence" : "",
        stats.activeEnrollments > 0 && stats.lessonsCompleted7d < 3
          ? "learning consistency"
          : "",
      ].filter(Boolean)
    )
  );

  const recentActionsMapped: PerformanceActionHistoryItem[] = recentActions.map((action) => ({
    id: action.id,
    type: action.type,
    title: action.title,
    description: action.description,
    status: action.status,
    executedAt: action.executedAt.toISOString(),
    whyThisWasSuggested: asReason(action),
  }));

  return {
    stats,
    nextActions,
    recentActions: recentActionsMapped,
    rationaleSummary,
    weakAreas,
  };
}