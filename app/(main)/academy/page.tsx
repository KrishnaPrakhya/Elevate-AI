"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  getAcademyDashboard,
  getPersonalizedRecommendations,
  getRealTimeSkillAnalysis,
  getAgentLearningRecommendations,
} from "@/actions/academy";
import { getUser } from "@/actions/user";
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
  Target,
  ExternalLink,
  X,
  Mic,
  GraduationCap,
  Trophy,
  Brain,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback } from "react";
import type {
  ForceGraphMethods,
  GraphData,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import StudyCompanion from "@/components/study-companion";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((mod) => mod.default),
  { ssr: false },
);

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
  id: string;
  label: string;
  importance: number;
  mastery: number;
  progressSignal: number;
  color: string;
  x?: number;
  y?: number;
}

interface SkillLink {
  source: string;
  target: string;
  strength: number;
}

interface ForceGraphNode extends SkillGraphNode {
  fx?: number;
  fy?: number;
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

  // Real-time skill analysis state
  const [skillGaps, setSkillGaps] = useState<
    { skill: string; importance: number }[]
  >([]);
  const [hasRealSkillData, setHasRealSkillData] = useState(false);
  const [skillDataSource, setSkillDataSource] = useState<
    "none" | "career_plan" | "llm_analysis" | "error"
  >("none");
  const [agentRecommendations, setAgentRecommendations] = useState<
    { title: string; description: string; action: string; priority: string }[]
  >([]);
  const [agentMessage, setAgentMessage] = useState("");

  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });
  const [isGraphReady, setIsGraphReady] = useState(false);
  const [graphKey, setGraphKey] = useState(0); // Force re-render graph
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  const refreshAcademyData = async () => {
    const [dashData, recData, skillAnalysis, agentRecs] = await Promise.all([
      getAcademyDashboard(),
      getPersonalizedRecommendations(),
      getRealTimeSkillAnalysis(),
      getAgentLearningRecommendations(),
    ]);
    setDashboard(dashData);
    setRecommendations(recData);
    setSkillGaps(skillAnalysis.topGaps || []);
    setSkillDataSource(
      (skillAnalysis.source || "none") as
        | "none"
        | "career_plan"
        | "llm_analysis"
        | "error",
    );
    setHasRealSkillData(
      Boolean(skillAnalysis.hasData) && skillAnalysis.source === "llm_analysis",
    );
    setAgentRecommendations(agentRecs.recommendations || []);
    setAgentMessage(agentRecs.message || "");
    // Force graph to re-render with new data
    setGraphKey((prev) => prev + 1);
    setCacheBuster(Date.now());
    // Reset graph ready state
    setIsGraphReady(false);
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
        const currentUserPromise = getUser().catch(() => null);
        await refreshAcademyData();
        const currentUser = await currentUserPromise;

        if (currentUser?.targetRole) {
          setSkillInput((prev) => prev || currentUser.targetRole || "");
        }

        const historyRes = await fetch("/api/career-planner").catch(() => null);
        if (historyRes?.ok) {
          const historyData = await historyRes.json();
          setPlanHistory(historyData.history || []);
          if (historyData.activePlan) {
            setGeneratedPlan(historyData.activePlan.planMarkdown || null);
            setPlanCheckpoints(historyData.activePlan.checkpoints || []);
            setPlanDetails(historyData.activePlan.planDetails || null);
            setSkillInput(
              (prev) =>
                prev ||
                historyData.activePlan.targetRole ||
                currentUser?.targetRole ||
                "",
            );
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

  useEffect(() => {
    if (loading) return;

    let observer: ResizeObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      const container = graphContainerRef.current;
      if (!container) {
        retryTimer = setTimeout(attach, 100);
        return;
      }

      const resize = () => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(400, Math.floor(rect.width));
        const height = 420;
        setGraphSize({ width, height });
        // Delay graph ready to ensure container is fully rendered
        setTimeout(() => setIsGraphReady(true), 100);
      };

      resize();
      observer = new ResizeObserver(resize);
      observer.observe(container);
    };

    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (observer) observer.disconnect();
    };
  }, [loading, graphKey]);

  const [selectedSkill, setSelectedSkill] = useState<ForceGraphNode | null>(
    null,
  );
  const [hoveredNode, setHoveredNode] = useState<ForceGraphNode | null>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);

  const skillGraph = useMemo(() => {
    // Don't compute graph until container is measured
    if (!isGraphReady || graphSize.width === 0 || graphSize.height === 0) {
      return { nodes: [], links: [] } as GraphData<ForceGraphNode, SkillLink>;
    }

    // Use LLM gaps when present, otherwise use plan-defined gaps.
    const mappedSkillGaps = hasRealSkillData
      ? skillGaps
      : planDetails?.topGaps || [];

    const hasLearningEvidence =
      stats.totalLessonsCompleted > 0 ||
      nextLessons.some((lesson) => (lesson.enrollment.progress || 0) > 0);

    // If no real skill data, return empty graph (show empty state in UI instead)
    if (
      !hasRealSkillData &&
      (!planDetails?.topGaps || planDetails.topGaps.length === 0)
    ) {
      return { nodes: [], links: [] } as GraphData<ForceGraphNode, SkillLink>;
    }

    const baseNodes: Omit<SkillGraphNode, "id" | "color">[] = mappedSkillGaps
      .slice(0, 6)
      .map((gap) => {
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
          : 0;

        const mastery = hasLearningEvidence
          ? Math.max(0, Math.min(100, Math.round(progressSignal)))
          : 0;

        return {
          label: gap.skill,
          importance: gap.importance,
          mastery,
          progressSignal,
        };
      });

    const palette = [
      "#3b82f6", // Blue
      "#06b6d4", // Cyan
      "#10b981", // Emerald
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#8b5cf6", // Violet
      "#ec4899", // Pink
      "#14b8a6", // Teal
    ];

    const centerX = graphSize.width / 2;
    const centerY = graphSize.height / 2;
    const radius = Math.min(
      graphSize.width * 0.28,
      graphSize.height * 0.35,
      160,
    );

    const nodes: ForceGraphNode[] = baseNodes.map((node, idx) => {
      const angle =
        (2 * Math.PI * idx) / Math.max(baseNodes.length, 1) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      return {
        id: `skill-${idx}`,
        ...node,
        color: palette[idx % palette.length],
        fx: x,
        fy: y,
      };
    });

    // Create links from center to all nodes
    const links: SkillLink[] = nodes.map((node) => ({
      source: "center",
      target: node.id,
      strength: node.importance / 10,
    }));

    // Add center node
    const graphAvgMastery =
      nodes.length > 0
        ? Math.round(
            nodes.reduce((sum, node) => sum + node.mastery, 0) / nodes.length,
          )
        : 0;

    const centerNode: ForceGraphNode = {
      id: "center",
      label: "You",
      importance: 10,
      mastery: graphAvgMastery,
      progressSignal: weeklyGoalProgress,
      color: "#1e293b",
      fx: centerX,
      fy: centerY,
    };

    const allNodes = [centerNode, ...nodes];

    // Set initial x/y to match fx/fy so graph starts centered
    allNodes.forEach((node) => {
      if (node.fx !== undefined) node.x = node.fx;
      if (node.fy !== undefined) node.y = node.fy;
    });

    return {
      nodes: allNodes,
      links,
    } as GraphData<ForceGraphNode, SkillLink>;
  }, [
    nextLessons,
    skillGaps,
    hasRealSkillData,
    planDetails?.topGaps,
    stats.totalLessonsCompleted,
    weeklyGoalProgress,
    isGraphReady,
    graphSize.width,
    graphSize.height,
  ]);

  // Re-center graph when data changes
  useEffect(() => {
    if (
      graphRef.current &&
      skillGraph.nodes.length > 0 &&
      isGraphReady &&
      graphSize.width > 0
    ) {
      // Center the graph immediately
      graphRef.current.centerAt(graphSize.width / 2, graphSize.height / 2, 0);
      graphRef.current.zoom(1, 0);
      // Then zoom to fit after a short delay
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(1000);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    isGraphReady,
    skillGraph.nodes.length,
    graphKey,
    graphSize.width,
    graphSize.height,
  ]);

  // Handle node click
  const handleNodeClick = useCallback((node: NodeObject) => {
    const typedNode = node as ForceGraphNode;
    if (typedNode.id === "center") return;
    setSelectedSkill(typedNode);
  }, []);

  // Handle node hover
  const handleNodeHover = useCallback((node: NodeObject | null) => {
    setHoveredNode(node as ForceGraphNode | null);
  }, []);

  // Custom link rendering

  // Helper to darken colors
  const adjustColor = (color: string, amount: number) => {
    const hex = color.replace("#", "");
    const r = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(0, 2), 16) + amount),
    );
    const g = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(2, 2), 16) + amount),
    );
    const b = Math.max(
      0,
      Math.min(255, parseInt(hex.substr(4, 2), 16) + amount),
    );
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  // Custom node rendering with enhanced visuals
  const renderNode = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D) => {
      const typedNode = node as ForceGraphNode;
      const isCenter = typedNode.id === "center";
      const baseRadius = isCenter ? 42 : 26 + (typedNode.importance || 5) * 0.5;
      // Use fixed positions (fx, fy) if available, otherwise use simulated positions
      const x = typedNode.fx ?? typedNode.x ?? graphSize.width / 2;
      const y = typedNode.fy ?? typedNode.y ?? graphSize.height / 2;
      const centerX = graphSize.width / 2;
      const isHovered = hoveredNode?.id === typedNode.id;
      const scale = isHovered ? 1.12 : 1;
      const radius = baseRadius * scale;

      // Animated outer glow ring
      const glowGradient = ctx.createRadialGradient(
        x,
        y,
        radius,
        x,
        y,
        radius * 2.2,
      );
      glowGradient.addColorStop(0, typedNode.color + "60");
      glowGradient.addColorStop(0.5, typedNode.color + "20");
      glowGradient.addColorStop(1, "transparent");
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing ring for center node
      if (isCenter) {
        const pulseRadius = radius + 10 + Math.sin(Date.now() / 300) * 4;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b82f680";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Main circle with gradient
      const mainGradient = ctx.createRadialGradient(
        x - radius * 0.3,
        y - radius * 0.3,
        0,
        x,
        y,
        radius,
      );
      mainGradient.addColorStop(0, isCenter ? "#60a5fa" : typedNode.color);
      mainGradient.addColorStop(0.7, isCenter ? "#2563eb" : typedNode.color);
      mainGradient.addColorStop(
        1,
        isCenter ? "#1d4ed8" : adjustColor(typedNode.color, -25),
      );

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = mainGradient;
      ctx.fill();

      // Bright border
      ctx.strokeStyle = isCenter
        ? "rgba(255,255,255,0.9)"
        : "rgba(255,255,255,0.5)";
      ctx.lineWidth = isHovered ? 3.5 : 2.5;
      ctx.stroke();

      // Inner decorative ring
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mastery percentage text with shadow
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "white";
      ctx.font = `bold ${isCenter ? 15 : 12}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(typedNode.mastery)}%`, x, y);
      ctx.shadowBlur = 0;

      // Label below node
      if (typedNode.label && !isCenter) {
        ctx.fillStyle = "#64748b";
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = x < centerX ? "right" : "left";
        const labelX = x < centerX ? x - radius - 14 : x + radius + 14;
        const label =
          typedNode.label.length > 18
            ? `${typedNode.label.substring(0, 16)}...`
            : typedNode.label;
        ctx.fillText(label, labelX, y + 4);
        ctx.textAlign = "center";
      }

      // Center node label
      if (isCenter) {
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillText("YOU", x, y - 12);
        ctx.fillStyle = "#93c5fd";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(`${Math.round(typedNode.mastery)}% avg`, x, y + 14);
      }
    },
    [graphSize.width, graphSize.height, hoveredNode],
  );

  if (loading) {
    return <AcademySkeleton />;
  }

  const getNodeColor = (node: NodeObject) => {
    const typedNode = node as ForceGraphNode;
    return typedNode.color;
  };

  const getNodeValue = (node: NodeObject) => {
    const typedNode = node as ForceGraphNode;
    return typedNode.id === "center"
      ? 35
      : 20 + (typedNode.importance || 5) * 0.8;
  };

  const renderLink = (link: LinkObject, ctx: CanvasRenderingContext2D) => {
    const startNode = link.source as ForceGraphNode | undefined;
    const endNode = link.target as ForceGraphNode | undefined;
    const startX = startNode?.x ?? 400;
    const startY = startNode?.y ?? 210;
    const endX = endNode?.x ?? 400;
    const endY = endNode?.y ?? 210;

    // Gradient along the link
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, "#3b82f660");
    gradient.addColorStop(0.5, "#06b6d480");
    gradient.addColorStop(1, "#3b82f660");

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.stroke();

    // Animated particle effect on links
    const time = Date.now() / 1500;
    const progress = time % 1;
    const particleX = startX + (endX - startX) * progress;
    const particleY = startY + (endY - startY) * progress;

    ctx.beginPath();
    ctx.arc(particleX, particleY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#06b6d4";
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
  };

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
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Your Skill Constellation
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasRealSkillData
                    ? "Evidence-based skill map from your actual learning progress"
                    : (planDetails?.topGaps?.length || 0) > 0
                      ? "Plan-seeded skill map. Progress unlocks when you complete lessons"
                      : "Generate a learning plan to visualize your skill gaps"}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary">
                {hasRealSkillData || (planDetails?.topGaps?.length || 0) > 0
                  ? `${Math.max(0, skillGraph.nodes.length - 1)} Skills ${hasRealSkillData ? "Tracked" : "Planned"}`
                  : "No Data"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Empty state when no skill data available */}
            {!hasRealSkillData &&
            (!planDetails?.topGaps || planDetails.topGaps.length === 0) ? (
              <div className="w-full h-[420px] flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BrainCircuit className="w-10 h-10 text-primary/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No Skill Data Yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Generate a personalized learning plan above to see your skill
                  gaps visualized as an interactive constellation.
                </p>
                <Button
                  onClick={() => {
                    const element = document.getElementById(
                      "generate-plan-section",
                    );
                    element?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Learning Plan
                </Button>
              </div>
            ) : (
              <div
                ref={graphContainerRef}
                className="w-full h-[420px] bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-100/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-cyan-950/30 rounded-2xl border border-primary/20 relative overflow-hidden"
                style={{ contain: "layout" }}
              >
                {/* Decorative background grid pattern */}
                <div
                  className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                  style={{
                    backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
                    backgroundSize: "40px 40px",
                  }}
                />
                {/* Radial glow effect */}
                <div className="absolute inset-0 bg-radial-gradient from-blue-500/5 to-transparent pointer-events-none" />

                {/* Loading state while measuring container */}
                {!isGraphReady && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Initializing skill graph...
                      </p>
                    </div>
                  </div>
                )}

                {/* Force Graph Component - positioned absolutely to fill container */}
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${isGraphReady ? "opacity-100" : "opacity-0"}`}
                >
                  <ForceGraph2D
                    key={`skill-graph-${graphKey}-${cacheBuster}`}
                    ref={graphRef}
                    width={graphSize.width}
                    height={graphSize.height}
                    graphData={skillGraph as unknown as GraphData}
                    nodeLabel="label"
                    nodeColor={getNodeColor}
                    nodeRelSize={6}
                    nodeVal={getNodeValue}
                    linkColor={() => "#3b82f6"}
                    linkWidth={1.5}
                    linkDirectionalArrowLength={0}
                    linkDirectionalArrowRelPos={1}
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    backgroundColor="transparent"
                    enableNodeDrag={false}
                    d3VelocityDecay={1}
                    warmupTicks={0}
                    cooldownTicks={0}
                    cooldownTime={0}
                    nodeCanvasObject={renderNode}
                    linkCanvasObject={renderLink}
                  />
                </div>

                {/* Stats overlays */}
                <div className="absolute left-4 top-4 z-10 rounded-xl border border-primary/20 bg-background/90 px-4 py-3 backdrop-blur-sm shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Mapped Skills
                  </p>
                  <p className="text-lg font-bold text-primary mt-0.5">
                    {skillGraph.nodes.length - 1} skills
                  </p>
                </div>

                <div className="absolute right-4 top-4 z-10 rounded-xl border border-primary/20 bg-background/90 px-4 py-3 backdrop-blur-sm shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Weekly Momentum
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {stats?.weeklyGoalProgress || 0}%
                    </p>
                  </div>
                </div>

                <div className="absolute left-4 bottom-4 z-10 rounded-xl border border-primary/20 bg-background/90 px-4 py-3 backdrop-blur-sm shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Active Tracks
                  </p>
                  <p className="text-lg font-bold mt-0.5">
                    {nextLessons.length}
                  </p>
                </div>

                <div className="absolute right-4 bottom-4 z-10 rounded-xl border border-primary/20 bg-background/90 px-4 py-3 backdrop-blur-sm shadow-lg">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Lessons Completed
                  </p>
                  <p className="text-lg font-bold text-primary mt-0.5">
                    {stats?.totalLessonsCompleted || 0}
                  </p>
                </div>

                {/* Hover tooltip - positioned relative to graph container */}
                <AnimatePresence>
                  {hoveredNode && hoveredNode.id !== "center" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute z-20 pointer-events-none"
                      style={{
                        left: `${(hoveredNode.x ?? graphSize.width / 2) + 50}px`,
                        top: `${(hoveredNode.y ?? graphSize.height / 2) - 80}px`,
                      }}
                    >
                      <div className="bg-background/98 backdrop-blur-md border border-primary/30 rounded-xl px-4 py-3 shadow-2xl min-w-[200px]">
                        <p className="font-semibold text-sm text-primary">
                          {hoveredNode.label ?? "Unknown Skill"}
                        </p>
                        <div className="mt-2 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Progress Signal
                            </span>
                            <span className="font-medium text-primary">
                              {Math.round(hoveredNode.mastery ?? 0)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Importance
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(hoveredNode.importance ?? 0)}/10
                            </Badge>
                          </div>
                          <Progress
                            value={hoveredNode.mastery ?? 0}
                            className="h-2 mt-2"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">
                          Click node for detailed analysis
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* AI-Powered Learning Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-primary/20 bg-gradient-to-br from-purple-500/10 to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-600" />
                  AI Learning Advisor
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalized recommendations based on your real-time progress
                </p>
              </div>
              <Badge
                variant="outline"
                className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {agentMessage && (
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-sm text-purple-900 dark:text-purple-100">
                  {agentMessage}
                </p>
              </div>
            )}

            {agentRecommendations.length > 0 ? (
              <div className="space-y-3">
                {agentRecommendations.map((rec, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    className="p-4 rounded-lg border border-primary/15 bg-background/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{rec.title}</h4>
                          <Badge
                            variant="outline"
                            className={
                              rec.priority === "high"
                                ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : rec.priority === "medium"
                                  ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            }
                          >
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                        <p className="text-xs text-primary mt-2 font-medium">
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-primary/30 text-sm text-muted-foreground">
                Generate a learning plan or enroll in a course to receive
                personalized AI recommendations.
              </div>
            )}
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
                No active learning sessions yet. Generate a Learning Plan below
                to start with a personalized plan.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions - Mentorship & Simulations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.27 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Mentorship Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-purple-500/10 to-background">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Mic className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Mentorship</CardTitle>
                <CardDescription>
                  Connect with experienced mentors
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Book 1-on-1 sessions with industry experts for personalized
              guidance on your career journey.
            </p>
            <Link href="/academy/mentors">
              <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
                <Mic className="w-4 h-4" />
                Find a Mentor
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Simulations Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-orange-500/10 to-background">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Brain className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle>Simulations</CardTitle>
                <CardDescription>Practice real-world scenarios</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Test your skills with interactive simulations of real-world
              technical and behavioral scenarios.
            </p>
            <Link href="/academy/simulation">
              <Button className="w-full gap-2 bg-orange-600 hover:bg-orange-700">
                <Brain className="w-4 h-4" />
                Start Simulation
              </Button>
            </Link>
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
        id="generate-plan-section"
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
              AI will create a personalized learning roadmap tailored to your
              goals
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
                  <p className="text-sm font-medium mb-2">Weekly Commitment</p>
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
                    <AIResponseFormatter
                      content={formatAIResponse(generatedPlan)}
                    />
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

      {/* Skill Detail Modal */}
      <AnimatePresence>
        {selectedSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedSkill(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-background rounded-2xl border border-primary/20 shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-primary/10 to-background border-b border-primary/20 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">
                    {selectedSkill.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Skill Analysis
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSkill(null)}
                  className="hover:bg-primary/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Mastery Gauge */}
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="hsl(var(--muted))"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke={selectedSkill.color}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(selectedSkill.mastery / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {Math.round(selectedSkill.mastery)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Current Progress Signal
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-primary/10 text-primary"
                      >
                        {selectedSkill.mastery < 30
                          ? "Beginner"
                          : selectedSkill.mastery < 60
                            ? "Intermediate"
                            : "Advanced"}
                      </Badge>
                    </div>
                    <Progress value={selectedSkill.mastery} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {selectedSkill.mastery < 30
                        ? "No meaningful completion evidence yet. Start mapped lessons for this skill"
                        : selectedSkill.mastery < 60
                          ? "You are building measurable momentum"
                          : "Excellent mastery! Consider teaching others"}
                    </p>
                  </div>
                </div>

                {!hasRealSkillData &&
                  skillDataSource === "career_plan" &&
                  planDetails?.topGaps && (
                    <div className="rounded-xl border border-amber-300/40 bg-amber-100/40 dark:bg-amber-900/20 p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Plan-driven mode: these skills are seeded from your
                        active plan. Signals remain 0% until you complete
                        related lessons.
                      </p>
                    </div>
                  )}

                {/* Skill Importance */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">
                      Importance for your goals
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          Priority Level
                        </span>
                        <span className="font-medium">
                          {selectedSkill.importance}/10
                        </span>
                      </div>
                      <Progress
                        value={(selectedSkill.importance / 10) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Related Learning Paths */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Recommended Learning Paths
                  </h4>
                  <div className="space-y-2">
                    {recommendedPaths
                      .filter((path) =>
                        path.title
                          .toLowerCase()
                          .includes(selectedSkill.label.toLowerCase()),
                      )
                      .slice(0, 3)
                      .map((path) => (
                        <div
                          key={path.id}
                          className="p-3 rounded-lg border border-primary/15 bg-background hover:border-primary/30 transition-colors"
                        >
                          <p className="text-sm font-medium">{path.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {path.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {path.level && (
                              <Badge variant="outline" className="text-xs">
                                {path.level}
                              </Badge>
                            )}
                            {path.estimatedHours && (
                              <Badge variant="outline" className="text-xs">
                                {path.estimatedHours}h
                              </Badge>
                            )}
                            <Link href="/academy/paths">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                              >
                                Start <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    {recommendedPaths.filter((path) =>
                      path.title
                        .toLowerCase()
                        .includes(selectedSkill.label.toLowerCase()),
                    ).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        No specific paths for this skill yet. Generate a new
                        Learning Plan to include it.
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setSkillInput(selectedSkill.label);
                      setSelectedSkill(null);
                      toast.info(`Generating plan for ${selectedSkill.label}`);
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Focus on this skill
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedSkill(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Interview Promotion Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-cyan-500/10 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-3 rounded-lg">
                  <Mic className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Voice Mock Interview
                  </CardTitle>
                  <CardDescription>
                    Practice with an Ollama Cloud interviewer using natural
                    voice conversation
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
              >
                <Zap className="w-3 h-3 mr-1" />
                Ollama Cloud
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold">Cloud Voice</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Natural conversation powered by Ollama Cloud and browser
                  speech tools
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">
                    Adaptive Questions
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Questions adjust based on your role, level, and responses
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-semibold">
                    Instant Feedback
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get detailed AI feedback on your performance immediately
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Link href="/interview/simulator-live">
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Mic className="w-4 h-4" />
                  Start Voice Interview
                </Button>
              </Link>
              <Link href="/interview">
                <Button variant="outline" className="gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Text Quiz
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Study Companion Floating Widget */}
      <StudyCompanion />
    </div>
  );
}
