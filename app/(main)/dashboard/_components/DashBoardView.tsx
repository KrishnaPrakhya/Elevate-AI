"use client";
import {
  Brain,
  Briefcase,
  LineChart,
  TrendingDown,
  TrendingUp,
  Calendar,
  Clock,
  Info,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Lightbulb,
  Award,
  Zap,
  DollarSign,
  BookOpen,
  Target,
  Mic,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import type { CareerInsight } from "@/lib/ai/career-agent";

type salaryInsights = {
  max: number;
  min: number;
  role: string;
  median: number;
  location: string;
};

export type IndustryInsights = {
  id: string;
  industry: string;
  salaryRanges: salaryInsights[];
  growthRate: number;
  demandLevel: string;
  topSkills: string[];
  marketOutLook: string;
  keyTrends: string[];
  recommendedSkills: string[];
  lastUpdated: Date | string;
  nextUpdated: Date | string;
};

interface Props {
  insights?: IndustryInsights | null;
  insightsLoading?: boolean;
  careerInsightLoading?: boolean;
  careerInsight?: CareerInsight | null;
  activePlan?: {
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
      weeklyPlan?: { week: number; focus: string; goals: string[] }[];
    };
  } | null;
  performanceInsights?: {
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
  } | null;
  userId?: string;
  academyData?: {
    enrollments: unknown[];
    stats: {
      currentStreak: number;
      weeklyGoalProgress: number;
      totalPoints: number;
      totalLessonsCompleted: number;
    };
  } | null;
  learningSummary?: {
    activeEnrollments: number;
    nextLesson: {
      title: string;
      pathTitle: string;
      enrollmentId: string;
    } | null;
    weeklyProgress: number;
  } | null;
}

function DashBoardView(props: Props) {
  const { insights, insightsLoading = false, careerInsightLoading = false } = props;
  const planStartDate = props.activePlan?.createdAt
    ? new Date(props.activePlan.createdAt)
    : null;
  const upcomingPlanWeeks =
    props.activePlan?.planDetails?.weeklyPlan?.slice(0, 3) || [];
  const [activeTab, setActiveTab] = useState("overview");
  console.log(insights);

  // Salary data can arrive either as absolute yearly values (e.g. 1_800_000)
  // or already in thousands (e.g. 1800). Normalize to "K" for display.
  const toSalaryK = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    const abs = Math.abs(value);
    return abs >= 100_000 ? value / 1000 : value;
  };

  const salaryData = (insights?.salaryRanges ?? []).map(
    (range: salaryInsights, index: number) => ({
      name: range.role,
      min: toSalaryK(range.min),
      max: toSalaryK(range.max),
      median: toSalaryK(range.median),
      color: getColorByIndex(index),
    }),
  );

  function getColorByIndex(index: number) {
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316"];
    return colors[index % colors.length];
  }

  const getDemandColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return {
          bg: "bg-emerald-500/20 dark:bg-emerald-500/30",
          text: "text-emerald-600 dark:text-emerald-400",
          border: "border-emerald-500/30",
          fill: "bg-emerald-500",
        };
      case "medium":
        return {
          bg: "bg-amber-500/20 dark:bg-amber-500/30",
          text: "text-amber-600 dark:text-amber-400",
          border: "border-amber-500/30",
          fill: "bg-amber-500",
        };
      case "low":
        return {
          bg: "bg-rose-500/20 dark:bg-rose-500/30",
          text: "text-rose-600 dark:text-rose-400",
          border: "border-rose-500/30",
          fill: "bg-rose-500",
        };
      default:
        return {
          bg: "bg-slate-500/20",
          text: "text-slate-600 dark:text-slate-400",
          border: "border-slate-500/30",
          fill: "bg-slate-500",
        };
    }
  };

  const getMarketOutlookInfo = (outlook: string) => {
    outlook = outlook.toLowerCase();
    switch (outlook) {
      case "positive":
        return {
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/20 dark:bg-emerald-500/30",
          border: "border-emerald-500/30",
        };
      case "neutral":
        return {
          icon: LineChart,
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/20 dark:bg-amber-500/30",
          border: "border-amber-500/30",
        };
      case "negative":
        return {
          icon: TrendingDown,
          color: "text-rose-600 dark:text-rose-400",
          bg: "bg-rose-500/20 dark:bg-rose-500/30",
          border: "border-rose-500/30",
        };
      default:
        return {
          icon: LineChart,
          color: "text-slate-600 dark:text-slate-400",
          bg: "bg-slate-500/20",
          border: "border-slate-500/30",
        };
    }
  };

  const OutlookInfo = getMarketOutlookInfo(insights?.marketOutLook ?? "neutral");
  const OutlookIcon = OutlookInfo.icon;
  const demandColors = getDemandColor(insights?.demandLevel ?? "medium");

  const lastUpdatedDate = insights ? format(new Date(insights.lastUpdated), "MMM d, yyyy") : null;
  const nextUpdatedDate = insights
    ? formatDistanceToNow(new Date(insights.nextUpdated), { addSuffix: true })
    : null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="space-y-6 pb-10">
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text mb-1">
            {insightsLoading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground text-2xl">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading insights…
              </span>
            ) : (
              (insights?.industry ?? "Industry") + " Insights"
            )}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {insightsLoading ? (
              <span className="text-sm">Fetching latest data…</span>
            ) : (
              <>
                <span className="text-sm">Last updated: {lastUpdatedDate}</span>
                <TooltipProvider>
                  <TooltipUI>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Next update {nextUpdatedDate}</p>
                    </TooltipContent>
                  </TooltipUI>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>

        {/* <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Clock className="h-4 w-4" />
            <span>Historical Data</span>
          </Button>
          <Button size="sm" className="gap-1">
            <ArrowUpRight className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div> */}
      </motion.div>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="salary">Salary Data</TabsTrigger>
          <TabsTrigger value="skills">Skills & Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Unified Progress Dashboard - Career Plan + Academy + Interview Prep */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2.5 rounded-lg">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        Your Learning Journey
                      </CardTitle>
                      <CardDescription>
                        Career plan progress, academy activity, and interview
                        prep
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    Live Progress
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Career Plan Status */}
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-semibold">Career Plan</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Target Role
                      </p>
                      <p className="text-sm font-medium">
                        {props.activePlan?.targetRole ||
                          props.careerInsight?.careerPathSuggestions?.[0]
                            ?.role ||
                          "Not set"}
                      </p>
                      {props.activePlan && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Timeline: {props.activePlan.timelineWeeks} weeks •{" "}
                            {props.activePlan.weeklyHours}h/week
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Plan source: {props.activePlan.source}
                          </p>
                        </>
                      )}
                      {!props.activePlan && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Generate your Learning Plan in Academy to unlock
                          plan-driven next steps.
                        </p>
                      )}
                      <div className="pt-2">
                        <Link href="/academy">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1"
                          >
                            <ArrowRight className="w-3 h-3" />
                            {props.activePlan ? "Open Plan" : "Create Plan"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Academy Progress */}
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-semibold">Academy</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Active Courses
                      </p>
                      <p className="text-sm font-medium">
                        {props.learningSummary?.activeEnrollments ||
                          props.academyData?.enrollments?.length ||
                          0}{" "}
                        courses
                      </p>
                      {props.learningSummary?.nextLesson && (
                        <div className="pt-1">
                          <p className="text-xs text-muted-foreground truncate">
                            Next:{" "}
                            {props.learningSummary.nextLesson.title.slice(
                              0,
                              25,
                            )}
                            ...
                          </p>
                          <div className="h-1.5 w-full bg-primary/20 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${props.learningSummary.weeklyProgress}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="pt-2">
                        <Link href="/academy">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1"
                          >
                            <BookOpen className="w-3 h-3" />
                            Go to Academy
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Interview Prep */}
                  <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-semibold">Interview Prep</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Weak Areas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {props.careerInsight?.skillGaps
                          ?.slice(0, 2)
                          .map((gap, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs"
                            >
                              {gap.skill}
                            </Badge>
                          )) || (
                          <span className="text-xs text-muted-foreground">
                            None tracked
                          </span>
                        )}
                      </div>
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <Link href="/interview">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1"
                          >
                            <Brain className="w-3 h-3" />
                            Quiz
                          </Button>
                        </Link>
                        <Link href="/interview/simulator-live">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1"
                          >
                            <Mic className="w-3 h-3 text-emerald-500" />
                            Voice
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Recommendations */}
                {props.careerInsight?.recommendedActions &&
                  props.careerInsight.recommendedActions.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          Next Recommended Action
                        </h4>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          <span className="font-medium">
                            {props.careerInsight.recommendedActions[0].title}
                          </span>{" "}
                          -{" "}
                          {
                            props.careerInsight.recommendedActions[0]
                              .description
                          }
                        </p>
                        <Badge
                          variant={
                            props.careerInsight.recommendedActions[0]
                              .priority === "high"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {props.careerInsight.recommendedActions[0].priority}
                        </Badge>
                      </div>
                    </div>
                  )}

                {props.activePlan &&
                  ((props.activePlan.checkpoints?.length || 0) > 0 ||
                    upcomingPlanWeeks.length > 0) && (
                    <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          Plan Checkpoints & Deadlines
                        </h4>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        {props.activePlan.checkpoints
                          ?.slice(0, 2)
                          .map((checkpoint, idx) => (
                            <p key={`${checkpoint.metric}-${idx}`}>
                              • {checkpoint.label}: {checkpoint.target}
                            </p>
                          ))}
                        {upcomingPlanWeeks.map((week, idx) => {
                          const dueDate =
                            planStartDate && Number.isFinite(week.week)
                              ? format(
                                  new Date(
                                    planStartDate.getTime() +
                                      Math.max(0, week.week - 1) *
                                        7 *
                                        24 *
                                        60 *
                                        60 *
                                        1000,
                                  ),
                                  "MMM d",
                                )
                              : "TBD";

                          return (
                            <p key={`${week.week}-${idx}`}>
                              • Week {week.week} ({dueDate}): {week.focus}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {props.performanceInsights && (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          Why AI Suggests These Next Steps
                        </h4>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        {props.performanceInsights.rationaleSummary.length >
                        0 ? (
                          props.performanceInsights.rationaleSummary
                            .slice(0, 3)
                            .map((reason, idx) => <p key={idx}>• {reason}</p>)
                        ) : (
                          <p>
                            • Recommendations are generated from your recent
                            assessment trends and activity cadence.
                          </p>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-border/50 p-2">
                          <p className="text-muted-foreground">Quiz Avg</p>
                          <p className="font-semibold">
                            {props.performanceInsights.stats
                              .technicalQuizAverage ?? "N/A"}
                            %
                          </p>
                        </div>
                        <div className="rounded border border-border/50 p-2">
                          <p className="text-muted-foreground">Interview Avg</p>
                          <p className="font-semibold">
                            {props.performanceInsights.stats
                              .interviewSimulationAverage ?? "N/A"}
                            %
                          </p>
                        </div>
                        <div className="rounded border border-border/50 p-2">
                          <p className="text-muted-foreground">Quizzes (14d)</p>
                          <p className="font-semibold">
                            {
                              props.performanceInsights.stats
                                .technicalQuizAttempts14d
                            }
                          </p>
                        </div>
                        <div className="rounded border border-border/50 p-2">
                          <p className="text-muted-foreground">
                            Voice Sims (14d)
                          </p>
                          <p className="font-semibold">
                            {
                              props.performanceInsights.stats
                                .interviewSimulations14d
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          Your Recent Actions
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {props.performanceInsights.recentActions.length > 0 ? (
                          props.performanceInsights.recentActions
                            .slice(0, 6)
                            .map((action) => (
                              <div
                                key={action.id}
                                className="rounded border border-border/50 p-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium">
                                    {action.title}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {formatDistanceToNow(
                                      new Date(action.executedAt),
                                      {
                                        addSuffix: true,
                                      },
                                    )}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {action.whyThisWasSuggested}
                                </p>
                              </div>
                            ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No tracked actions yet. Complete a quiz, interview,
                            or lesson to build your performance history.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Career Insights Card */}
          {props.careerInsight &&
            props.careerInsight.recommendedActions?.length > 0 && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2.5 rounded-lg">
                          <Brain className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            AI Career Insights
                          </CardTitle>
                          <CardDescription>
                            Personalized recommendations based on your profile
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        AI-Powered
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Skill Gaps */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          Priority Skill Gaps
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {props.careerInsight.skillGaps
                            .slice(0, 4)
                            .map((gap, idx) => (
                              <Link
                                key={idx}
                                href={`/academy/paths?search=${encodeURIComponent(gap.skill)}`}
                              >
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer hover:bg-primary/10 transition-colors gap-1"
                                >
                                  {gap.skill}
                                  <span className="text-xs opacity-60">
                                    ({gap.importance}/10)
                                  </span>
                                </Badge>
                              </Link>
                            ))}
                        </div>
                      </div>

                      {/* Recommended Actions */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-primary" />
                          Recommended Actions
                        </h4>
                        <div className="space-y-2">
                          {props.careerInsight.recommendedActions
                            .slice(0, 3)
                            .map((action, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-background/50 border border-border/50"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {action.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {action.description}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      action.priority === "high"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs shrink-0"
                                  >
                                    {action.priority}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Career Path Suggestions */}
                    {props.careerInsight.careerPathSuggestions?.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          Suggested Career Paths
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {props.careerInsight.careerPathSuggestions.map(
                            (path, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-lg bg-primary/5 border border-primary/20"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-medium text-sm">
                                    {path.role}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {path.matchScore}% match
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {path.skillsNeeded
                                    .slice(0, 2)
                                    .map((skill, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="text-xs px-1.5 py-0.5 rounded bg-background/50"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  {path.skillsNeeded.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{path.skillsNeeded.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <Card
                className="overflow-hidden border-t-4 transition-all hover:shadow-md"
                style={{
                  borderTopColor: OutlookInfo.color.includes("emerald")
                    ? "#10b981"
                    : OutlookInfo.color.includes("amber")
                      ? "#f59e0b"
                      : OutlookInfo.color.includes("rose")
                        ? "#f43f5e"
                        : "#64748b",
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Market Outlook</CardTitle>
                  <div className={cn("p-1.5 rounded-full", OutlookInfo.bg)}>
                    {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <OutlookIcon className={cn("h-4 w-4", OutlookInfo.color)} />}
                  </div>
                </CardHeader>
                <CardContent>
                  {insightsLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-7 w-24 rounded bg-muted" />
                      <div className="h-3 w-32 rounded bg-muted" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{insights?.marketOutLook}</div>
                        <div className={cn("text-xs px-2 py-0.5 rounded-full", OutlookInfo.bg, OutlookInfo.color)}>Trend</div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />Next update {nextUpdatedDate}
                      </p>
                    </>
                  )}
                </CardContent>
                <div className={cn("h-1.5", OutlookInfo.bg)}></div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-t-4 border-t-indigo-500 transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Industry Growth</CardTitle>
                  <div className="p-1.5 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30">
                    {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                </CardHeader>
                <CardContent>
                  {insightsLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-7 w-16 rounded bg-muted" />
                      <div className="h-2 w-full rounded bg-muted" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{insights?.growthRate.toFixed(1)}%</div>
                        <div className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400">Annual</div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Growth Rate</span>
                          <span className="font-medium">{insights?.growthRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={Number(insights?.growthRate.toFixed(1))} className="h-2" indicatorClassName="bg-indigo-500" />
                      </div>
                    </>
                  )}
                </CardContent>
                <div className="h-1.5 bg-indigo-500/20 dark:bg-indigo-500/30"></div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card
                className={cn("overflow-hidden border-t-4 transition-all hover:shadow-md")}
                style={{
                  borderTopColor: demandColors.text.includes("emerald") ? "#10b981" : demandColors.text.includes("amber") ? "#f59e0b" : demandColors.text.includes("rose") ? "#f43f5e" : "#64748b",
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Demand Level</CardTitle>
                  <div className={cn("p-1.5 rounded-full", demandColors.bg)}>
                    {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Briefcase className={cn("h-4 w-4", demandColors.text)} />}
                  </div>
                </CardHeader>
                <CardContent>
                  {insightsLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-7 w-20 rounded bg-muted" />
                      <div className="h-2 w-full rounded bg-muted" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold">{insights?.demandLevel}</div>
                        <div className={cn("text-xs px-2 py-0.5 rounded-full", demandColors.bg, demandColors.text)}>Current</div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Demand Indicator</span>
                          <span className={cn("font-medium", demandColors.text)}>{insights?.demandLevel}</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", demandColors.fill)}
                            style={{ width: insights?.demandLevel?.toLowerCase() === "high" ? "90%" : insights?.demandLevel?.toLowerCase() === "medium" ? "60%" : "30%" }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
                <div className={cn("h-1.5", demandColors.bg)}></div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-t-4 border-t-purple-500 transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Top Skills</CardTitle>
                  <div className="p-1.5 rounded-full bg-purple-500/20 dark:bg-purple-500/30">
                    {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                  </div>
                </CardHeader>
                <CardContent>
                  {insightsLoading ? (
                    <div className="flex flex-wrap gap-1.5 animate-pulse">
                      {[80, 60, 72, 55, 65].map((w) => (
                        <div key={w} className="h-5 rounded-full bg-muted" style={{ width: w }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {(insights?.topSkills ?? []).map((skill) => (
                          <Badge key={skill} variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors">{skill}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                        <Award className="h-3 w-3" />Most in-demand skills
                      </p>
                    </>
                  )}
                </CardContent>
                <div className="h-1.5 bg-purple-500/20 dark:bg-purple-500/30"></div>
              </Card>
            </motion.div>
          </motion.div>

          {/* Salary Chart */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="overflow-hidden transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Salary Ranges by Role
                    </CardTitle>
                    <CardDescription>
                      Displaying minimum, median, and maximum salaries (in
                      thousands)
                    </CardDescription>
                  </div>
                  {/* <Button variant="outline" size="sm" className="gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Full Report</span>
                  </Button> */}
                </div>
              </CardHeader>

              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salaryData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      barGap={8}
                      barSize={20}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#888"
                        strokeOpacity={0.2}
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 12 }}
                        tickFormatter={(value) => `${value}K`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-sm mb-2">
                                  {label}
                                </p>
                                {payload.map((item) => (
                                  <div
                                    key={item.name}
                                    className="flex items-center justify-between gap-4 text-sm"
                                  >
                                    <span className="flex items-center gap-1">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                      ></span>
                                      {item.name}:
                                    </span>
                                    <span className="font-medium">
                                      {item.value}K
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                      />
                      <Bar
                        dataKey="min"
                        name="Min Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`${getColorByIndex(index)}80`}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="median"
                        name="Median Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getColorByIndex(index)}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="max"
                        name="Max Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`${getColorByIndex(index)}B0`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Salary Data Tab */}
        <TabsContent value="salary" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Detailed Salary Analysis
                      </CardTitle>
                      <CardDescription>
                        Comprehensive breakdown of salary data across different
                        roles
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salaryData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#888"
                          strokeOpacity={0.2}
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#888", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#888", fontSize: 12 }}
                          tickFormatter={(value) => `${value}K`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium text-sm mb-2">
                                    {label}
                                  </p>
                                  {payload.map((item) => (
                                    <div
                                      key={item.name}
                                      className="flex items-center justify-between gap-4 text-sm"
                                    >
                                      <span className="flex items-center gap-1">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{
                                            backgroundColor: item.color,
                                          }}
                                        ></span>
                                        {item.name}:
                                      </span>
                                      <span className="font-medium">
                                        {item.value}K
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="min"
                          name="Min Salary"
                          stroke="#6366f180"
                          fill="#6366f120"
                          activeDot={{ r: 6 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="median"
                          name="Median Salary"
                          stroke="#8b5cf680"
                          fill="#8b5cf620"
                          activeDot={{ r: 6 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="max"
                          name="Max Salary"
                          stroke="#ec489980"
                          fill="#ec489920"
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>

                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  {insightsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full animate-pulse">
                      {[1,2,3].map(i => <div key={i} className="space-y-1"><div className="h-4 w-24 rounded bg-muted"/><div className="h-3 w-32 rounded bg-muted"/><div className="h-4 w-20 rounded bg-muted"/></div>)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                      {(insights?.salaryRanges ?? []).map((range, index) => (
                        <div key={index} className="flex flex-col space-y-1">
                          <div className="text-sm font-medium">{range.role}</div>
                          <div className="text-xs text-muted-foreground">{range.location}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-xs">Range:</div>
                            <div className="text-sm font-medium">{toSalaryK(range.min).toFixed(0)}K - {toSalaryK(range.max).toFixed(0)}K</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* Skills & Trends Tab */}
        <TabsContent value="skills" className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Key Industry Trends */}
            <motion.div variants={itemVariants}>
              <Card className="h-full overflow-hidden transition-all hover:shadow-md border-t-4 border-t-rose-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-rose-500" />
                    Key Industry Trends
                  </CardTitle>
                  <CardDescription>
                    Current trends shaping the industry
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insightsLoading ? (
                    <div className="space-y-3 animate-pulse">
                      {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-muted" />)}
                    </div>
                  ) : null}
                  {!insightsLoading && (insights?.keyTrends ?? []).map((trend, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
                    >
                      <div className="mt-0.5">
                        <div className="h-6 w-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                          <ChevronRight className="h-4 w-4 text-rose-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm">{trend}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  <Button variant="outline" size="sm" className="gap-1 w-full">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>View Industry Report</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Recommended Skills */}
            <motion.div variants={itemVariants}>
              <Card className="h-full overflow-hidden transition-all hover:shadow-md border-t-4 border-t-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Recommended Skills
                  </CardTitle>
                  <CardDescription>
                    Click to explore courses for each skill
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {insightsLoading ? (
                      Array.from({length: 4}).map((_,i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)
                    ) : (insights?.recommendedSkills ?? []).map((skill, index) => (
                      <Link
                        key={index}
                        href={`/academy/paths?search=${encodeURIComponent(skill)}`}
                        className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/20 cursor-pointer group"
                      >
                        <Zap className="h-4 w-4 text-amber-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">{skill}</span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  <Link href="/academy/paths" className="w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 w-full"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Browse All Learning Paths</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashBoardView;
