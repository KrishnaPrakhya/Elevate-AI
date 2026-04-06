import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { CACHE_TTL, getCachedData, invalidateCachePattern, redis } from "@/lib/redis";
import {
  analyzeCareerProfile,
  analyzeSkillGaps,
  recommendLearningPath,
  type CareerInsight,
} from "@/lib/ai/career-agent";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

type PlannerPayload = {
  targetRole?: string;
  timelineWeeks?: number;
  weeklyHours?: number;
  skillsToDevelop?: string[];
  focusArea?: string;
  source?: "academy" | "career-tools";
};

type PlanCheckpoint = {
  label: string;
  metric: string;
  target: string;
};

type PlanHistoryEntry = {
  id: string;
  version: number;
  createdAt: string;
  source: "academy" | "career-tools";
  targetRole: string;
  timelineWeeks: number;
  weeklyHours: number;
  planMarkdown: string;
  checkpoints: PlanCheckpoint[];
  planDetails: {
    topGaps: { skill: string; importance: number }[];
    topActions: { title: string; priority: string; description: string }[];
    weeklyPlan: { week: number; focus: string; goals: string[] }[];
    milestones: { week: number; achievement: string }[];
    recommendedPaths: { id: string; title: string; description: string }[];
  };
};

const PLAN_HISTORY_LIMIT = 20;
const PLAN_HISTORY_TTL = CACHE_TTL.WEEK * 12; // 84 days

function buildHistoryKey(userId: string): string {
  return `career-planner:history:${userId}`;
}

function buildActiveKey(userId: string): string {
  return `career-planner:active:${userId}`;
}

function buildCheckpoints(params: {
  timelineWeeks: number;
  weeklyHours: number;
  gapsCount: number;
  milestonesCount: number;
  targetRole: string;
}): PlanCheckpoint[] {
  const { timelineWeeks, weeklyHours, gapsCount, milestonesCount, targetRole } = params;

  return [
    {
      label: "Weekly Learning Commitment",
      metric: "study_hours_per_week",
      target: `${weeklyHours}h`,
    },
    {
      label: "Skill Gap Closure",
      metric: "critical_gaps_to_close",
      target: `${Math.max(1, gapsCount)} gaps in ${timelineWeeks} weeks`,
    },
    {
      label: "Milestone Completion",
      metric: "learning_milestones",
      target: `${Math.max(1, milestonesCount)} milestones`,
    },
    {
      label: "Role Readiness",
      metric: "target_role",
      target: targetRole,
    },
  ];
}

async function getPlanHistory(userId: string): Promise<PlanHistoryEntry[]> {
  try {
    return (await redis.get<PlanHistoryEntry[]>(buildHistoryKey(userId))) || [];
  } catch (error) {
    console.error("Failed to read career planner history:", error);
    return [];
  }
}

async function savePlanHistory(userId: string, entry: PlanHistoryEntry): Promise<void> {
  try {
    const existing = await getPlanHistory(userId);
    const next = [entry, ...existing].slice(0, PLAN_HISTORY_LIMIT);
    await redis.set(buildHistoryKey(userId), next, { ex: PLAN_HISTORY_TTL });
  } catch (error) {
    console.error("Failed to persist career planner history:", error);
  }
}

async function saveActivePlan(userId: string, entry: PlanHistoryEntry): Promise<void> {
  try {
    await redis.set(buildActiveKey(userId), entry, { ex: PLAN_HISTORY_TTL });
  } catch (error) {
    console.error("Failed to persist active career plan:", error);
  }
}

async function getActivePlan(userId: string): Promise<PlanHistoryEntry | null> {
  try {
    return (await redis.get<PlanHistoryEntry>(buildActiveKey(userId))) || null;
  } catch (error) {
    console.error("Failed to read active career plan:", error);
    return null;
  }
}

function toTimelineLabel(weeks: number): "1 month" | "3 months" | "6 months" | "1 year" {
  if (weeks <= 4) return "1 month";
  if (weeks <= 12) return "3 months";
  if (weeks <= 24) return "6 months";
  return "1 year";
}

function buildCacheKey(userId: string, payload: PlannerPayload): string {
  const normalized = {
    userId,
    targetRole: (payload.targetRole || "").trim().toLowerCase(),
    timelineWeeks: payload.timelineWeeks || 8,
    weeklyHours: payload.weeklyHours || 8,
    focusArea: (payload.focusArea || "").trim().toLowerCase(),
    skillsToDevelop: Array.from(
      new Set((payload.skillsToDevelop || []).map((s) => s.trim().toLowerCase()).filter(Boolean))
    ).sort(),
    source: payload.source || "career-tools",
  };

  const hash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 28);

  return `career-planner:${hash}`;
}

function asList(items: string[], fallback = "None identified yet") {
  return items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : `- ${fallback}`;
}

function buildPlanMarkdown(params: {
  targetRole: string;
  timelineWeeks: number;
  weeklyHours: number;
  focusArea: string;
  insight: CareerInsight;
  skillGapSummary: { gaps: string[]; learningResources: string[] };
  learningPath: Awaited<ReturnType<typeof recommendLearningPath>>;
  recommendedPaths: { id: string; title: string; description: string }[];
  mcpTools: { name: string; status: string; purpose: string; actionUrl: string }[];
}) {
  const {
    targetRole,
    timelineWeeks,
    weeklyHours,
    focusArea,
    insight,
    skillGapSummary,
    learningPath,
    recommendedPaths,
    mcpTools,
  } = params;

  const topActions = insight.recommendedActions.slice(0, 5).map((a) => `- **${a.title}** (${a.priority}) - ${a.description}`);
  const topTrends = insight.marketTrends.slice(0, 3).map((t) => `- **${t.trend}** (${t.impact}) - ${t.description}`);
  const topGaps = insight.skillGaps.slice(0, 5).map((g) => `- **${g.skill}** (importance ${g.importance}/10)`);

  return `## Career Planner\n\n**Target Role:** ${targetRole}\n\n**Timeline:** ${timelineWeeks} weeks\n\n**Weekly Commitment:** ${weeklyHours} hrs/week\n\n**Focus Constraints:** ${focusArea || "Not specified"}\n\n### 1. AI Skill Gap Diagnosis\n${topGaps.length ? topGaps.join("\n") : "- No major gaps detected"}\n\n### 2. Recommended Actions\n${topActions.length ? topActions.join("\n") : "- No actions generated"}\n\n### 3. Market Signals\n${topTrends.length ? topTrends.join("\n") : "- No trends generated"}\n\n### 4. Structured Learning Path\n- **Path Name:** ${learningPath.pathName}\n- **Milestones:** ${learningPath.milestones.length}\n\n${learningPath.weeklyPlan.slice(0, 6).map((w) => `- Week ${w.week}: **${w.focus}** (${w.goals.join("; ")})`).join("\n") || "- Weekly plan pending"}\n\n### 5. Extra Skill Gap Agent Output\n#### Missing Skills\n${asList(skillGapSummary.gaps)}\n\n#### Suggested Learning Resources\n${asList(skillGapSummary.learningResources)}\n\n### 6. Academy Path Mapping\n${recommendedPaths.length > 0 ? recommendedPaths.map((p) => `- [${p.title}](/academy/paths) - ${p.description.slice(0, 120)}...`).join("\n") : "- No direct path matches found. Use /academy/paths for broader discovery."}\n\n### 7. Tool Integrations (MCP-Ready)\n${mcpTools.map((t) => `- **${t.name}** [${t.status}] - ${t.purpose} ([Open](${t.actionUrl}))`).join("\n")}\n\n### 8. Next 7-Day Execution Checklist\n- Block ${Math.max(3, Math.round(weeklyHours * 0.6))} hours for skill-building in Academy\n- Complete 1 interview drill from Interview module\n- Refresh resume bullet points for your top 2 skill gaps\n- Use Career Advisor chat to review blockers every 2 days\n`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 requests per minute per user
    const limit = rateLimit(request, { interval: 60 * 1000, maxRequests: 5 });
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before generating another plan." },
        { status: 429 }
      );
    }

    const payload = (await request.json()) as PlannerPayload;

    const user = await db.user.findUnique({
      where: { clerkUserId },
      include: {
        resume: true,
        coverLetter: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Use centralized targetRole from user profile, fallback to payload or industry
    const targetRole = (payload.targetRole || user.targetRole || user.industry || "Career Growth").trim();
    const timelineWeeks = Number(payload.timelineWeeks || 8);
    const weeklyHours = Number(payload.weeklyHours || 8);
    const focusArea = payload.focusArea || "";
    const skillsToDevelop = (payload.skillsToDevelop || []).filter(Boolean);

    const cacheKey = buildCacheKey(user.id, {
      targetRole,
      timelineWeeks,
      weeklyHours,
      focusArea,
      skillsToDevelop,
      source: payload.source,
    });

    const result = await getCachedData(
      cacheKey,
      async () => {
        const baseSkills = user.skills || [];
        const mergedSkills = Array.from(new Set([...baseSkills, ...skillsToDevelop.map((s) => s.trim())])).filter(Boolean);

        const [insight, learningPath, skillGapSummary] = await Promise.all([
          analyzeCareerProfile(
            {
              industry: user.industry,
              experience: user.experience,
              skills: mergedSkills,
              bio: user.bio,
              targetRole,
            },
            {
              recentActivity: payload.source === "academy" ? "Learning from Academy module" : "Using Career Tools planner",
            }
          ),
          recommendLearningPath(
            mergedSkills,
            targetRole,
            weeklyHours,
            toTimelineLabel(timelineWeeks)
          ),
          analyzeSkillGaps(mergedSkills, targetRole, user.industry || "technology"),
        ]);

        const recommendedPaths = await db.learningPath.findMany({
          where: {
            isPublished: true,
            OR: [
              { industry: user.industry },
              { title: { contains: targetRole, mode: "insensitive" } },
              ...skillGapSummary.gaps.slice(0, 4).map((skill) => ({
                title: { contains: skill, mode: "insensitive" as const },
              })),
            ],
          },
          select: {
            id: true,
            title: true,
            description: true,
          },
          take: 4,
        });

        const mcpTools = [
          {
            name: "Career Advisor Agent",
            status: "active",
            purpose: "Real-time guidance and planning chat",
            actionUrl: "/chatbot",
          },
          {
            name: "Academy Learning Engine",
            status: "active",
            purpose: "Mapped courses for role and skills",
            actionUrl: "/academy/paths",
          },
          {
            name: "Interview Prep Agent",
            status: "active",
            purpose: "Role-aligned mock drills and quiz loops",
            actionUrl: "/interview",
          },
          {
            name: "Resume Optimizer",
            status: "active",
            purpose: "ATS-oriented updates for target role",
            actionUrl: "/resume",
          },
        ];

        const planMarkdown = buildPlanMarkdown({
          targetRole,
          timelineWeeks,
          weeklyHours,
          focusArea,
          insight,
          skillGapSummary,
          learningPath,
          recommendedPaths,
          mcpTools,
        });

        return {
          planMarkdown,
          insight,
          learningPath,
          skillGapSummary,
          recommendedPaths,
          mcpTools,
          metadata: {
            source: payload.source || "career-tools",
            generatedAt: new Date().toISOString(),
          },
        };
      },
      CACHE_TTL.MEDIUM
    );

    const history = await getPlanHistory(user.id);
    const nextVersion = (history[0]?.version || 0) + 1;
    const checkpoints = buildCheckpoints({
      timelineWeeks,
      weeklyHours,
      gapsCount: result.skillGapSummary?.gaps?.length || 0,
      milestonesCount: result.learningPath?.milestones?.length || 0,
      targetRole,
    });

    const savedPlan: PlanHistoryEntry = {
      id: createHash("sha256")
        .update(`${user.id}:${nextVersion}:${Date.now()}`)
        .digest("hex")
        .slice(0, 16),
      version: nextVersion,
      createdAt: new Date().toISOString(),
      source: payload.source || "career-tools",
      targetRole,
      timelineWeeks,
      weeklyHours,
      planMarkdown: result.planMarkdown,
      checkpoints,
      planDetails: {
        topGaps: (result.insight?.skillGaps || []).slice(0, 5).map((g: { skill: string; importance: number }) => ({
          skill: g.skill,
          importance: g.importance,
        })),
        topActions: (result.insight?.recommendedActions || []).slice(0, 6).map((a: { title: string; priority: string; description: string }) => ({
          title: a.title,
          priority: a.priority,
          description: a.description,
        })),
        weeklyPlan: (result.learningPath?.weeklyPlan || []).slice(0, 8),
        milestones: result.learningPath?.milestones || [],
        recommendedPaths: result.recommendedPaths || [],
      },
    };

    let autoEnrollment: {
      enrollmentId: string;
      learningPathId: string;
      learningPathTitle: string;
      activated: boolean;
      reason?: string;
    } | null = null;

    if ((payload.source || "career-tools") === "academy") {
      const candidatePaths = result.recommendedPaths || [];

      if (candidatePaths.length > 0) {
        const existingActiveEnrollment = await db.enrollment.findFirst({
          where: {
            userId: user.id,
            learningPathId: { in: candidatePaths.map((p) => p.id) },
            progress: { lt: 100 },
          },
          include: {
            learningPath: { select: { id: true, title: true } },
          },
        });

        if (existingActiveEnrollment) {
          autoEnrollment = {
            enrollmentId: existingActiveEnrollment.id,
            learningPathId: existingActiveEnrollment.learningPath.id,
            learningPathTitle: existingActiveEnrollment.learningPath.title,
            activated: false,
            reason: "already-active",
          };
        } else {
          const pathToActivate = await db.learningPath.findFirst({
            where: {
              id: { in: candidatePaths.map((p) => p.id) },
            },
            include: {
              modules: {
                orderBy: { order: "asc" },
                include: {
                  lessons: { orderBy: { order: "asc" } },
                },
              },
            },
          });

          if (pathToActivate) {
            const alreadyEnrolled = await db.enrollment.findFirst({
              where: {
                userId: user.id,
                learningPathId: pathToActivate.id,
              },
            });

            if (!alreadyEnrolled) {
              const firstModule = pathToActivate.modules[0];
              const firstLesson = firstModule?.lessons[0];

              const enrollment = await db.enrollment.create({
                data: {
                  userId: user.id,
                  learningPathId: pathToActivate.id,
                  currentModuleId: firstModule?.id,
                  currentLessonId: firstLesson?.id,
                  lastAccessedAt: new Date(),
                },
              });

              autoEnrollment = {
                enrollmentId: enrollment.id,
                learningPathId: pathToActivate.id,
                learningPathTitle: pathToActivate.title,
                activated: true,
              };
            } else {
              autoEnrollment = {
                enrollmentId: alreadyEnrolled.id,
                learningPathId: pathToActivate.id,
                learningPathTitle: pathToActivate.title,
                activated: false,
                reason: "already-enrolled",
              };
            }
          }
        }
      }

      await Promise.all([
        invalidateCachePattern(`academy:dashboard:${user.id}:*`),
        invalidateCachePattern(`academy:recommendations:${user.id}:*`),
        invalidateCachePattern(`academy:userEnrollments:${user.id}`),
      ]);
    }

    await savePlanHistory(user.id, savedPlan);
    await saveActivePlan(user.id, savedPlan);

    return NextResponse.json({
      ...result,
      checkpoints,
      savedPlan,
      autoEnrollment,
    });
  } catch (error) {
    console.error("Error generating career planner:", error);
    return NextResponse.json(
      { error: "Failed to generate career planner" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const history = await getPlanHistory(user.id);
    const activePlan = await getActivePlan(user.id);
    return NextResponse.json({ history, activePlan });
  } catch (error) {
    console.error("Error loading planner history:", error);
    return NextResponse.json({ error: "Failed to load planner history" }, { status: 500 });
  }
}
