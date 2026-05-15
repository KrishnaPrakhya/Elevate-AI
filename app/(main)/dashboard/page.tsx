"use client";

import { getDashboardInsights } from "@/actions/dashboard";
import { getOnboardingStatus, getUser } from "@/actions/user";
import { getAcademyDashboard } from "@/actions/academy";
import { getPerformanceIntelligence } from "@/actions/performance";
import { getUserLearningSummary } from "@/lib/integrations/academy-career-bridge";
import type { CareerInsight } from "@/lib/ai/career-agent";
import { pageCache } from "@/lib/page-cache";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import DashBoardView, { IndustryInsights } from "./_components/DashBoardView";
import { IndustryInsight } from "@prisma/client";
import { Flame, BookOpen, Trophy, Play, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/loaders/skeleton-loader";
export interface SalaryRange {
  role: string;
  min: number;
  max: number;
  median: number;
  location: string;
}

export interface DashboardInsights extends Omit<
  IndustryInsight,
  "salaryRanges"
> {
  salaryRanges: SalaryRange[];
}

type ActivePlan = {
  id: string;
  targetRole: string;
  source: "academy" | "career-tools";
  createdAt: string;
  timelineWeeks: number;
  weeklyHours: number;
  checkpoints: {
    label: string;
    metric: string;
    target: string;
  }[];
  planDetails?: {
    topActions?: {
      title: string;
      priority: "high" | "medium" | "low";
      description: string;
    }[];
    topGaps?: { skill: string; importance: number }[];
    weeklyPlan?: { week: number; focus: string; goals: string[] }[];
  };
};

interface DashboardData {
  rawInsights: DashboardInsights;
  academyData: {
    enrollments: unknown[];
    stats: {
      currentStreak: number;
      weeklyGoalProgress: number;
      totalPoints: number;
      totalLessonsCompleted: number;
    };
  } | null;
  learningSummary: {
    activeEnrollments: number;
    nextLesson: {
      title: string;
      pathTitle: string;
      enrollmentId: string;
    } | null;
    weeklyProgress: number;
  } | null;
  user: {
    id: string;
    industry?: string | null;
    experience?: number | null;
    skills?: string[];
    bio?: string | null;
  } | null;
  careerInsight: CareerInsight | null;
  performanceInsights: {
    stats: {
      technicalQuizAverage: number | null;
      interviewSimulationAverage: number | null;
      technicalQuizAttempts14d: number;
      interviewSimulations14d: number;
      lessonsCompleted7d: number;
      activeEnrollments: number;
      operationsTracked7d: number;
    };
    nextActions: CareerInsight["recommendedActions"];
    recentActions: {
      id: string;
      type: string;
      title: string;
      description: string;
      status: string;
      executedAt: string;
      whyThisWasSuggested: string;
    }[];
    rationaleSummary: string[];
    weakAreas: string[];
  } | null;
  activePlan: ActivePlan | null;
}

function mapPlanActions(
  activePlan: ActivePlan | null,
): CareerInsight["recommendedActions"] {
  const topActions = activePlan?.planDetails?.topActions || [];
  return topActions.slice(0, 5).map((action) => ({
    type: "skill",
    title: action.title,
    description: action.description,
    priority: action.priority,
    reasoning: `From your active ${activePlan?.source || "academy"} plan for ${activePlan?.targetRole || "your target role"}.`,
    actionUrl: "/academy",
  }));
}

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which expensive sections are still loading after initial render
  const [sectionStatus, setSectionStatus] = useState<{
    insights: "loading" | "done" | "error";
    careerInsight: "loading" | "done" | "error";
  }>({ insights: "loading", careerInsight: "loading" });
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function loadCareerInsights(
      user: DashboardData["user"],
      learningSummary: DashboardData["learningSummary"],
      performanceInsights: DashboardData["performanceInsights"],
      activePlan: DashboardData["activePlan"],
    ) {
      if (!user || !isMounted) return;

      const response = await fetch("/api/career-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: user.industry,
          experience: user.experience,
          skills: user.skills || [],
          bio: user.bio,
          targetRole: activePlan?.targetRole,
          recentActivity: learningSummary
            ? `Active enrollments: ${learningSummary.activeEnrollments}`
            : undefined,
          weakAreas:
            (performanceInsights?.weakAreas?.length ?? 0) > 0
              ? performanceInsights?.weakAreas
              : activePlan?.planDetails?.topGaps?.map((gap) => gap.skill) ||
                undefined,
        }),
      }).catch(() => null);

      if (!isMounted) return;

      if (!response?.ok) {
        setSectionStatus((s) => ({ ...s, careerInsight: "error" }));
        return;
      }

      const careerInsight = (await response.json()) as CareerInsight;
      const planActions = mapPlanActions(activePlan);
      const statsActions = performanceInsights?.nextActions || [];
      const planFirstAction: CareerInsight["recommendedActions"][number] = {
        type: "course",
        title: "Generate your Academy Learning Plan",
        description:
          "Create your plan first so all next steps, interview cadence, and deadlines align to one roadmap.",
        priority: "high",
        reasoning:
          "Plan-first mode is required before personalized execution recommendations are finalized.",
        actionUrl: "/academy#generate-plan-section",
      };

      const mergedActions: CareerInsight["recommendedActions"] = !activePlan
        ? [planFirstAction]
        : planActions.length > 0
          ? planActions
          : statsActions.length > 0
            ? statsActions
            : careerInsight.recommendedActions || [];

      if (!isMounted) return;
      setData((prev) =>
        prev
          ? {
              ...prev,
              careerInsight: {
                ...careerInsight,
                recommendedActions: mergedActions,
              },
            }
          : prev,
      );
      setSectionStatus((s) => ({ ...s, careerInsight: "done" }));
    }

    async function load() {
      try {
        // ── Phase 1: fast DB-only calls (~300 ms first visit, ~0 ms repeat) ─
        // pageCache serves from memory instantly on repeat navigations.
        // Background refresh kicks in automatically when entry is >60 s old.
        const [onboardingResult, academyData, learningSummary, user, performanceInsights, plannerState] =
          await Promise.all([
            pageCache.get("dashboard:onboarding", () =>
              getOnboardingStatus().catch(() => ({ isOnBoardingStatus: true }))
            ),
            pageCache.get("dashboard:academy", () =>
              getAcademyDashboard().catch(() => null)
            ),
            pageCache.get("dashboard:learningSummary", () =>
              getUserLearningSummary().catch(() => null)
            ),
            pageCache.get("dashboard:user", () =>
              getUser().catch(() => null)
            ),
            pageCache.get("dashboard:performance", () =>
              getPerformanceIntelligence().catch(() => null)
            ),
            pageCache.get("dashboard:planner", () =>
              fetch("/api/career-planner")
                .then((res) => (res.ok ? res.json() : null))
                .catch(() => null),
              30_000 // planner can go slightly stale faster
            ),
          ]);

        if (!onboardingResult.isOnBoardingStatus) {
          router.replace("/onboarding");
          return;
        }

        if (!isMounted) return;

        const activePlan = plannerState?.activePlan || null;

        // Render dashboard immediately with fast data (insights = null → shows skeleton)
        setData({
          rawInsights: null as unknown as DashboardInsights,
          academyData,
          learningSummary,
          user,
          careerInsight: null,
          performanceInsights,
          activePlan,
        });
        setLoading(false);

        // ── Phase 2: background AI calls (non-blocking) ───────────────────
        pageCache.get(
          "dashboard:insights",
          () => getDashboardInsights(),
          // AI insights are expensive — keep for 5 min before background refresh
          5 * 60_000,
          // onRefresh: UI updates automatically when background refresh completes
          (rawInsights) => {
            if (!isMounted) return;
            const insights: IndustryInsights = {
              ...rawInsights,
              salaryRanges: (rawInsights.salaryRanges as unknown as SalaryRange[]).filter(Boolean),
              demandLevel: rawInsights.demandLevel as "HIGH" | "MEDIUM" | "LOW",
              marketOutLook: rawInsights.marketOutLook as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
            };
            setData((prev) =>
              prev ? { ...prev, rawInsights: insights as unknown as DashboardInsights } : prev
            );
          }
        )
          .then((rawInsights) => {
            if (!isMounted) return;
            const insights: IndustryInsights = {
              ...rawInsights,
              salaryRanges: (rawInsights.salaryRanges as unknown as SalaryRange[]).filter(Boolean),
              demandLevel: rawInsights.demandLevel as "HIGH" | "MEDIUM" | "LOW",
              marketOutLook: rawInsights.marketOutLook as "POSITIVE" | "NEUTRAL" | "NEGATIVE",
            };
            setData((prev) =>
              prev ? { ...prev, rawInsights: insights as unknown as DashboardInsights } : prev
            );
            setSectionStatus((s) => ({ ...s, insights: "done" }));
          })
          .catch(() => {
            if (isMounted) setSectionStatus((s) => ({ ...s, insights: "error" }));
          });

        void loadCareerInsights(user, learningSummary, performanceInsights, activePlan);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        if (!isMounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Failed to load dashboard</p>
      </div>
    );
  }

  const {
    rawInsights,
    academyData,
    learningSummary,
    user,
    careerInsight,
    performanceInsights,
    activePlan,
  } = data;
  const hasActiveEnrollment =
    learningSummary && learningSummary.activeEnrollments > 0;

  return (
    <div className="container mx-auto">
      {/* Real-time loading progress bar */}
      {(sectionStatus.insights === "loading" || sectionStatus.careerInsight === "loading") && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-primary animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
        </div>
      )}
      {/* Section loading status banner */}
      {sectionStatus.insights === "loading" && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2 border border-border/50">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>Fetching AI-powered industry insights in the background…</span>
        </div>
      )}
      {/* Continue Learning Card - Shows when user has active enrollment */}
      {hasActiveEnrollment && learningSummary?.nextLesson && (
        <Card className="mb-6 border-primary/30 bg-gradient-to-r from-primary/10 to-blue-500/10 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-lg">
                  <Play className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Continue Learning</h3>
                  <p className="text-sm text-muted-foreground">
                    Next: {learningSummary.nextLesson.title} in{" "}
                    {learningSummary.nextLesson.pathTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-32 bg-primary/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${learningSummary.weeklyProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(learningSummary.weeklyProgress)}% this week
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/academy/learn/${learningSummary.nextLesson.enrollmentId}`}
              >
                <Button className="gap-2">
                  <Play className="w-4 h-4" />
                  Continue
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academy Quick Stats Banner */}
      {academyData && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-200/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-orange-500/20 p-3 rounded-lg">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {academyData.stats.currentStreak}
                </p>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {academyData.stats.totalLessonsCompleted}
                </p>
                <p className="text-sm text-muted-foreground">Lessons Done</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-200/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <Trophy className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {academyData.stats.totalPoints}
                </p>
                <p className="text-sm text-muted-foreground">
                  Achievement Points
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-500/20 p-3 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {academyData.enrollments?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Courses</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DashBoardView
        insights={rawInsights}
        careerInsight={careerInsight}
        performanceInsights={performanceInsights}
        activePlan={activePlan}
        userId={user?.id}
        academyData={academyData}
        learningSummary={learningSummary}
        insightsLoading={sectionStatus.insights === "loading"}
        careerInsightLoading={sectionStatus.careerInsight === "loading"}
      />
    </div>
  );
}

export default DashboardPage;
