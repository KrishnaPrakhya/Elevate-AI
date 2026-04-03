"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAcademyDashboard,
  getPersonalizedRecommendations,
} from "@/actions/academy";
import { AcademySkeleton } from "@/components/loaders/skeleton-loader";
import {
  BookOpen,
  Zap,
  BrainCircuit,
  Play,
  TrendingUp,
  Plus,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

interface DashboardData {
  enrollments: unknown[];
  streak: unknown;
  todayGoal: unknown;
  achievements: unknown[];
  recentSubmissions: unknown[];
  stats: {
    totalLessonsCompleted: number;
    totalAssignmentsCompleted: number;
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    weeklyGoalProgress: number;
  };
}

interface Recommendations {
  recommendedPaths: {
    id: string;
    title: string;
    description: string;
    estimatedHours?: number | null;
    level?: string;
  }[];
  nextLessons: {
    enrollment: {
      id: string;
      progress: number;
      learningPath: {
        id: string;
        title: string;
      };
    };
    currentLesson?: {
      id: string;
      title: string;
      estimatedMinutes?: number | null;
    } | null;
  }[];
  aiTip: string;
}

interface PlanCheckpoint {
  label: string;
  metric: string;
  target: string;
}

interface PlanHistoryItem {
  id: string;
  version: number;
  createdAt: string;
  source: "academy" | "career-tools";
  targetRole: string;
  timelineWeeks: number;
  weeklyHours: number;
  planMarkdown: string;
  checkpoints: PlanCheckpoint[];
  planDetails?: {
    topGaps: { skill: string; importance: number }[];
    topActions: { title: string; priority: string; description: string }[];
    weeklyPlan: { week: number; focus: string; goals: string[] }[];
    milestones: { week: number; achievement: string }[];
    recommendedPaths: { id: string; title: string; description: string }[];
  };
}

interface SkillGraphNode {
  label: string;
  importance: number;
  mastery: number;
  progressSignal: number;
}

export default function AcademyPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recommendations, setRecommendations] =
    useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillInput, setSkillInput] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState("8");
  const [weeklyHours, setWeeklyHours] = useState("10");
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [planCheckpoints, setPlanCheckpoints] = useState<PlanCheckpoint[]>([]);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [planDetails, setPlanDetails] = useState<
    PlanHistoryItem["planDetails"] | null
  >(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const refreshAcademyData = async () => {
    const [dashData, recData] = await Promise.all([
      getAcademyDashboard(),
      getPersonalizedRecommendations(),
    ]);
    setDashboard(dashData);
    setRecommendations(recData);
  };

  const handleGeneratePlan = async () => {
    if (!skillInput.trim()) {
      toast.error("Enter a target skill or role first");
      return;
    }

    setIsGeneratingPlan(true);
    setGeneratedPlan(null);
    setPlanCheckpoints([]);
    setPlanDetails(null);

    try {
      const response = await fetch("/api/career-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: skillInput,
          timelineWeeks: Number(timelineWeeks),
          weeklyHours: Number(weeklyHours),
          source: "academy",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate planner");
      }

      const data = await response.json();
      setGeneratedPlan(
        data.planMarkdown || "Plan generated, but no content returned.",
      );
      setPlanCheckpoints(data.checkpoints || []);
      setPlanDetails(data.savedPlan?.planDetails || null);
      if (data.savedPlan) {
        setPlanHistory((prev) => [data.savedPlan, ...prev].slice(0, 12));
      }
      await refreshAcademyData();

      if (data.autoEnrollment?.activated) {
        toast.success(
          `Learning Plan activated: ${data.autoEnrollment.learningPathTitle}`,
        );
      }
      toast.success("Learning Plan generated successfully");
    } catch (error) {
      console.error("Error generating hyper-path:", error);
      toast.error("Failed to generate Learning Plan");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        await refreshAcademyData();

        const historyRes = await fetch("/api/career-planner").catch(() => null);
        if (historyRes?.ok) {
          const historyData = await historyRes.json();
          setPlanHistory(historyData.history || []);
          if (historyData.activePlan) {
            setGeneratedPlan(historyData.activePlan.planMarkdown || null);
            setPlanCheckpoints(historyData.activePlan.checkpoints || []);
            setPlanDetails(historyData.activePlan.planDetails || null);
          }
        }
      } catch (error) {
        console.error("Error loading academy dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = dashboard?.stats ?? {
    currentStreak: 0,
    weeklyGoalProgress: 0,
    totalPoints: 0,
    totalLessonsCompleted: 0,
    totalAssignmentsCompleted: 0,
    longestStreak: 0,
  };

  const weeklyGoalProgress = stats.weeklyGoalProgress || 0;
  const nextLessons = useMemo(
    () => recommendations?.nextLessons ?? [],
    [recommendations?.nextLessons],
  );
  const recommendedPaths = useMemo(
    () => recommendations?.recommendedPaths ?? [],
    [recommendations?.recommendedPaths],
  );

  const skillGraph = useMemo(() => {
    const fallbackSkills = recommendedPaths
      .slice(0, 6)
      .map((path) => path.title.split(/[-:|]/)[0]?.trim())
      .filter(Boolean) as string[];

    const baseNodes: SkillGraphNode[] =
      planDetails?.topGaps?.slice(0, 6).map((gap) => {
        const relatedLessons = nextLessons.filter((lesson) =>
          lesson.enrollment.learningPath.title
            .toLowerCase()
            .includes(gap.skill.toLowerCase()),
        );

        const relatedProgress = relatedLessons.reduce(
          (sum, lesson) => sum + lesson.enrollment.progress,
          0,
        );

        const progressSignal = relatedLessons.length
          ? Math.round(relatedProgress / relatedLessons.length)
          : weeklyGoalProgress;

        const mastery = Math.max(
          15,
          Math.min(
            95,
            Math.round(100 - gap.importance * 7 + progressSignal * 0.35),
          ),
        );

        return {
          label: gap.skill,
          importance: gap.importance,
          mastery,
          progressSignal,
        };
      }) ||
      fallbackSkills.map((skill, idx) => {
        const importance = Math.max(3, 8 - idx);
        const progressSignal = Math.round(
          weeklyGoalProgress * (0.82 + idx * 0.03),
        );
        const mastery = Math.max(
          20,
          Math.min(90, Math.round(100 - importance * 6 + progressSignal * 0.3)),
        );

        return {
          label: skill,
          importance,
          mastery,
          progressSignal,
        };
      });

    const palette = [
      "#2563eb",
      "#0ea5e9",
      "#0891b2",
      "#16a34a",
      "#ca8a04",
      "#f97316",
      "#dc2626",
      "#7c3aed",
    ];

    const center = { x: 300, y: 155 };
    const baseRadius = 112;

    const nodes = baseNodes.map((node, idx) => {
      const angle =
        (2 * Math.PI * idx) / Math.max(baseNodes.length, 1) - Math.PI / 2;
      const pull = 1 + (node.importance - 5) * 0.04;

      return {
        ...node,
        x: center.x + Math.cos(angle) * baseRadius * pull,
        y: center.y + Math.sin(angle) * baseRadius * pull,
        color: palette[idx % palette.length],
      };
    });

    return {
      center,
      nodes,
      avgMastery: nodes.length
        ? Math.round(
            nodes.reduce((sum, node) => sum + node.mastery, 0) / nodes.length,
          )
        : 0,
    };
  }, [nextLessons, planDetails?.topGaps, recommendedPaths, weeklyGoalProgress]);

  if (loading) {
    return <AcademySkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-primary" />
            Learning Plan Academy
          </h1>
          <p className="text-muted-foreground">
            AI-powered skill mastery with personalized learning paths
          </p>
        </div>
      </motion.div>

      {/* Skill Constellation / Knowledge Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your Skill Constellation
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Live graph generated from active plan gaps and current learning
              progress
            </p>
          </CardHeader>
          <CardContent>
            <div className="w-full h-80 bg-gradient-to-br from-primary/5 via-background to-cyan-500/10 rounded-xl border border-primary/20 flex items-center justify-center relative overflow-hidden">
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 600 300"
              >
                {skillGraph.nodes.map((node, idx) => (
                  <g key={idx}>
                    <line
                      x1={skillGraph.center.x}
                      y1={skillGraph.center.y}
                      x2={node.x}
                      y2={node.y}
                      stroke={node.color}
                      strokeWidth={1.8 + node.importance * 0.15}
                      opacity={0.2 + (100 - node.mastery) / 260}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={12 + node.importance * 0.7}
                      fill={node.color}
                      opacity="0.12"
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={8 + node.mastery * 0.08}
                      fill={node.color}
                      opacity="0.34"
                      strokeWidth="1.4"
                      stroke={node.color}
                    />
                    <text
                      x={node.x}
                      y={node.y - 16}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="#0f172a"
                      opacity="0.84"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 3}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill="#334155"
                      opacity="0.82"
                    >
                      {node.mastery}%
                    </text>
                  </g>
                ))}

                <circle
                  cx={skillGraph.center.x}
                  cy={skillGraph.center.y}
                  r="33"
                  fill="#0f172a"
                  opacity="0.08"
                />
                <circle
                  cx={skillGraph.center.x}
                  cy={skillGraph.center.y}
                  r="26"
                  fill="url(#gradient1)"
                  strokeWidth="1.8"
                  stroke="#334155"
                  opacity="0.32"
                />
                <text
                  x={skillGraph.center.x}
                  y={skillGraph.center.y - 2}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#0f172a"
                  opacity="0.72"
                >
                  Profile
                </text>
                <text
                  x={skillGraph.center.x}
                  y={skillGraph.center.y + 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#0f172a"
                  opacity="0.8"
                >
                  {skillGraph.avgMastery}%
                </text>

                <defs>
                  <radialGradient id="gradient1" cx="30%" cy="30%">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity="0.18" />
                    <stop
                      offset="100%"
                      stopColor="#0f172a"
                      stopOpacity="0.04"
                    />
                  </radialGradient>
                </defs>
              </svg>

              <div className="absolute left-4 top-4 z-10 rounded-lg border border-primary/20 bg-background/80 px-3 py-2 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Mapped Skills
                </p>
                <p className="text-sm font-semibold">
                  {skillGraph.nodes.length} live nodes
                </p>
              </div>

              <div className="absolute right-4 bottom-4 z-10 rounded-lg border border-primary/20 bg-background/80 px-3 py-2 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Momentum
                </p>
                <p className="text-sm font-semibold">
                  {stats?.weeklyGoalProgress || 0}% weekly target
                </p>
              </div>

              <div className="relative z-10 mt-52 text-center pointer-events-none">
                <p className="text-xs text-muted-foreground font-medium">
                  {nextLessons.length} active tracks driving{" "}
                  {stats?.totalLessonsCompleted || 0} completed lessons
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Total Points</p>
                <p className="text-xl font-bold text-primary">
                  {stats?.totalPoints || 0}
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Current Streak</p>
                <p className="text-xl font-bold text-orange-500">
                  {stats?.currentStreak || 0} days
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Lessons Done</p>
                <p className="text-xl font-bold text-green-600">
                  {stats?.totalLessonsCompleted || 0}
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Weekly Goal</p>
                <p className="text-xl font-bold text-blue-600">
                  {stats?.weeklyGoalProgress || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Learning Roadmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Active Learning Roadmap
              </CardTitle>
              <Badge variant="outline">{nextLessons.length} Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Continue where you left off with personalized next-lesson guidance
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextLessons.length > 0 ? (
              nextLessons.map((item, idx) => (
                <motion.div
                  key={item.enrollment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-background to-primary/5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500">
                        <BookOpen className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">
                            {item.currentLesson?.title || "Continue your path"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {item.enrollment.learningPath.title}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700"
                        >
                          In Progress
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Progress
                          </span>
                          <span className="font-medium">
                            {Math.round(item.enrollment.progress)}%
                          </span>
                        </div>
                        <Progress
                          value={item.enrollment.progress}
                          className="h-2"
                        />
                      </div>

                      <p className="text-xs text-muted-foreground mt-2">
                        {item.currentLesson?.estimatedMinutes
                          ? `${item.currentLesson.estimatedMinutes} min estimated for next lesson`
                          : "Next lesson ready"}
                      </p>
                    </div>

                    <Link href={`/academy/learn/${item.enrollment.id}`}>
                      <Button size="sm" variant="outline" className="mt-1">
                        <Play className="w-4 h-4 mr-2" />
                        Continue
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-primary/30 text-sm text-muted-foreground">
                No active learning sessions yet. Generate a Learning Plan below to
                start with a personalized plan.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Practical Path Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-500" />
              Recommended Programs For You
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Practical paths mapped from your current profile and skill gaps
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendedPaths.length > 0 ? (
              recommendedPaths.map((path) => (
                <div
                  key={path.id}
                  className="p-4 rounded-lg border border-primary/15 bg-background/70 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold">{path.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {path.description}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {path.level && (
                        <Badge variant="outline">{path.level}</Badge>
                      )}
                      {path.estimatedHours ? (
                        <Badge variant="outline">{path.estimatedHours}h</Badge>
                      ) : null}
                    </div>
                  </div>
                  <Link href="/academy/paths">
                    <Button size="sm">Explore</Button>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No specific recommendations yet. Complete onboarding details and
                generate your Learning Plan.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Generate Learning Plan Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Generate Your Learning Plan
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              AI will create a personalized learning roadmap
              tailored to your goals
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Skill Input */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Target Skill or Role
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="E.g., System Design, Full Stack Development, ML Engineering..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Learning Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background rounded-lg border border-primary/10">
                <div>
                  <p className="text-sm font-medium mb-2">Learning Duration</p>
                  <select
                    value={timelineWeeks}
                    onChange={(e) => setTimelineWeeks(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-primary/20 text-sm bg-background"
                  >
                    <option value="4">4 weeks</option>
                    <option value="8">8 weeks</option>
                    <option value="12">12 weeks</option>
                    <option value="16">16 weeks</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">
                    Weekly Commitment
                  </p>
                  <select
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-primary/20 text-sm bg-background"
                  >
                    <option value="5">Light (5 hrs/week)</option>
                    <option value="10">Moderate (10 hrs/week)</option>
                    <option value="15">Intensive (15 hrs/week)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={handleGeneratePlan}
                  disabled={isGeneratingPlan}
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingPlan
                    ? "Generating Plan..."
                    : "Generate Learning Plan"}
                </Button>
              </div>

              {generatedPlan && (
                <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-background via-primary/5 to-cyan-500/5 p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80">
                        Plan Blueprint
                      </p>
                      <p className="text-lg font-semibold leading-tight">
                        Your Integrated Career Plan
                      </p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground">
                      Versioned
                    </Badge>
                  </div>
                  {planDetails ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-background p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Top Skill Gaps
                          </p>
                          <div className="mt-3 space-y-2.5 text-sm">
                            {planDetails.topGaps?.map((gap) => (
                              <div
                                key={gap.skill}
                                className="flex items-center justify-between rounded-md border border-primary/15 bg-background/80 px-2.5 py-2"
                              >
                                <span className="font-medium">{gap.skill}</span>
                                <Badge variant="outline">
                                  {gap.importance}/10
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-background p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Milestones
                          </p>
                          <div className="mt-3 space-y-2.5 text-sm">
                            {planDetails.milestones
                              ?.slice(0, 5)
                              .map((m, idx) => (
                                <div
                                  key={`${m.week}-${idx}`}
                                  className="rounded-md border border-border/60 bg-background/80 p-2.5"
                                >
                                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                    Week {m.week}
                                  </p>
                                  <p className="font-medium leading-snug">
                                    {m.achievement}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                          Weekly Sprint Plan
                        </p>
                        <div className="space-y-2.5">
                          {planDetails.weeklyPlan?.slice(0, 6).map((w) => (
                            <div
                              key={w.week}
                              className="rounded-lg border border-border/60 bg-muted/20 p-3"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Week {w.week}
                              </p>
                              <p className="text-sm font-semibold leading-snug mt-1">
                                {w.focus}
                              </p>
                              <ul className="list-disc pl-5 text-xs text-muted-foreground mt-1">
                                {w.goals?.map((goal, idx) => (
                                  <li key={`${w.week}-${idx}`}>{goal}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                      {generatedPlan}
                    </ReactMarkdown>
                  )}

                  {planCheckpoints.length > 0 && (
                    <div className="mt-5 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-background p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                        Execution Checkpoints
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {planCheckpoints.map((checkpoint, idx) => (
                          <div
                            key={`${checkpoint.metric}-${idx}`}
                            className="rounded-md border border-primary/15 bg-background/85 p-2.5 text-xs"
                          >
                            <p className="font-semibold">{checkpoint.label}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {checkpoint.metric}: {checkpoint.target}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {planHistory.length > 0 && (
                <div className="p-4 rounded-lg border border-primary/15 bg-background">
                  <p className="font-medium mb-2">Saved Plan Versions</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {planHistory.slice(0, 6).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setGeneratedPlan(item.planMarkdown);
                          setPlanCheckpoints(item.checkpoints || []);
                          setPlanDetails(item.planDetails || null);
                          setSkillInput(item.targetRole);
                          setTimelineWeeks(String(item.timelineWeeks));
                          setWeeklyHours(String(item.weeklyHours));
                        }}
                        className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <p className="text-xs font-medium">
                          V{item.version} - {item.targetRole}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()} (
                          {item.source})
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-1">💡 Learning Plans Include:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Structured learning modules with AI tutoring</li>
                  <li>Real-world projects & case studies</li>
                  <li>Adaptive difficulty based on your performance</li>
                  <li>Daily challenges & peer collaboration features</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Recommendation Banner */}
      {recommendations?.aiTip && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">AI Insight</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {recommendations.aiTip}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
