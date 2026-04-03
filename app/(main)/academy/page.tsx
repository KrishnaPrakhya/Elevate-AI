"use client";

import { useEffect, useState } from "react";
import { getAcademyDashboard, getPersonalizedRecommendations } from "@/actions/academy";
import {
  Loader2,
  BookOpen,
  Zap,
  BrainCircuit,
  Play,
  Target,
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
  recommendedPaths: unknown[];
  nextLessons: unknown[];
  aiTip: string;
}

export default function AcademyPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillInput, setSkillInput] = useState("");
  const [simulationDifficulty, setSimulationDifficulty] = useState("intermediate");

  useEffect(() => {
    async function load() {
      try {
        const [dashData, recData] = await Promise.all([
          getAcademyDashboard(),
          getPersonalizedRecommendations(),
        ]);
        setDashboard(dashData);
        setRecommendations(recData);
      } catch (error) {
        console.error("Error loading academy dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats } = dashboard || {
    stats: {
      currentStreak: 0,
      weeklyGoalProgress: 0,
      totalPoints: 0,
      totalLessonsCompleted: 0,
      totalAssignmentsCompleted: 0,
    },
  };

  // Mock data for active simulations
  const activeSimulations = [
    {
      id: 1,
      title: "API Design Interview Simulation",
      topic: "System Design",
      difficulty: "hard",
      progress: 65,
      timeSpent: "28 min",
    },
    {
      id: 2,
      title: "React Performance Optimization",
      topic: "Frontend Engineering",
      difficulty: "intermediate",
      progress: 40,
      timeSpent: "15 min",
    },
    {
      id: 3,
      title: "Database Query Optimization",
      topic: "Backend Engineering",
      difficulty: "intermediate",
      progress: 85,
      timeSpent: "42 min",
    },
  ];

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
            Hyper-Path Academy
          </h1>
          <p className="text-muted-foreground">
            AI-powered skill mastery through personalized simulations
          </p>
        </div>
      </motion.div>

      {/* Skill Constellation / Knowledge Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your Skill Constellation
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your knowledge graph shows interconnected skills and mastery levels
            </p>
          </CardHeader>
          <CardContent>
            {/* Placeholder for Knowledge Graph Visualization */}
            <div className="w-full h-80 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent rounded-lg border border-primary/20 flex items-center justify-center relative overflow-hidden">
              {/* SVG-based Knowledge Graph Placeholder */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 300">
                {/* Central node */}
                <circle cx="300" cy="150" r="30" fill="#000" opacity="0.1" />
                <circle cx="300" cy="150" r="25" fill="url(#gradient1)" strokeWidth="2" stroke="#000" opacity="0.3" />
                <text x="300" y="155" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000" opacity="0.5">
                  You
                </text>

                {/* Skill nodes */}
                {[
                  { x: 100, y: 80, label: "React", color: "#3b82f6" },
                  { x: 500, y: 80, label: "System Design", color: "#8b5cf6" },
                  { x: 100, y: 220, label: "Node.js", color: "#10b981" },
                  { x: 500, y: 220, label: "SQL", color: "#f59e0b" },
                  { x: 300, y: 280, label: "DevOps", color: "#ec4899" },
                ].map((node, idx) => (
                  <g key={idx}>
                    {/* Connection line */}
                    <line
                      x1="300"
                      y1="150"
                      x2={node.x}
                      y2={node.y}
                      stroke={node.color}
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    {/* Skill node */}
                    <circle cx={node.x} cy={node.y} r="18" fill={node.color} opacity="0.2" />
                    <circle cx={node.x} cy={node.y} r="15" fill={node.color} opacity="0.4" strokeWidth="1.5" stroke={node.color} />
                    <text
                      x={node.x}
                      y={node.y + 3}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#000"
                      opacity="0.7"
                    >
                      {node.label}
                    </text>
                  </g>
                ))}

                <defs>
                  <radialGradient id="gradient1" cx="30%" cy="30%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.05" />
                  </radialGradient>
                </defs>
              </svg>

              {/* Overlay text */}
              <div className="relative z-10 text-center pointer-events-none">
                <p className="text-sm text-muted-foreground font-medium">
                  Mastering {stats?.totalLessonsCompleted || 0} core concepts
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Total Points</p>
                <p className="text-xl font-bold text-primary">{stats?.totalPoints || 0}</p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Current Streak</p>
                <p className="text-xl font-bold text-orange-500">{stats?.currentStreak || 0} days</p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Lessons Done</p>
                <p className="text-xl font-bold text-green-600">{stats?.totalLessonsCompleted || 0}</p>
              </div>
              <div className="p-3 bg-background rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground">Weekly Goal</p>
                <p className="text-xl font-bold text-blue-600">{stats?.weeklyGoalProgress || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active AI Simulations */}
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
                Active AI Simulations
              </CardTitle>
              <Badge variant="outline">3 Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Continue your immersive skill-building scenarios
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSimulations.map((sim, idx) => (
              <motion.div
                key={sim.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-background to-primary/5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{
                        background:
                          idx === 0
                            ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
                            : idx === 1
                              ? "linear-gradient(135deg, #3b82f6, #06b6d4)"
                              : "linear-gradient(135deg, #10b981, #14b8a6)",
                      }}
                    >
                      {idx === 0 ? (
                        <GitBranch className="w-6 h-6" />
                      ) : idx === 1 ? (
                        <BookOpen className="w-6 h-6" />
                      ) : (
                        <Target className="w-6 h-6" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{sim.title}</h3>
                        <p className="text-sm text-muted-foreground">{sim.topic}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          sim.difficulty === "hard"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }
                      >
                        {sim.difficulty}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{sim.progress}%</span>
                      </div>
                      <Progress value={sim.progress} className="h-2" />
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">{sim.timeSpent} invested</p>
                  </div>

                  <Button size="sm" variant="outline" className="mt-1">
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Generate Hyper-Path Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Generate Your Hyper-Path
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              AI will create a personalized learning and simulation roadmap tailored to your goals
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Skill Input */}
              <div>
                <label className="text-sm font-medium mb-2 block">Target Skill or Role</label>
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

              {/* Difficulty Selection */}
              <div>
                <label className="text-sm font-medium mb-3 block">Difficulty & Pace</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {["beginner", "intermediate", "advanced"].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSimulationDifficulty(level)}
                      className={`p-4 rounded-lg border-2 transition-colors text-center capitalize font-medium ${
                        simulationDifficulty === level
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-primary/20 bg-background text-foreground hover:border-primary/40"
                      }`}
                    >
                      {level === "beginner" && "🌱 Beginner"}
                      {level === "intermediate" && "🚀 Intermediate"}
                      {level === "advanced" && "⚡ Advanced"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background rounded-lg border border-primary/10">
                <div>
                  <p className="text-sm font-medium mb-2">Learning Duration</p>
                  <select className="w-full px-3 py-2 rounded-md border border-primary/20 text-sm bg-background">
                    <option>2 weeks</option>
                    <option>1 month</option>
                    <option>3 months</option>
                    <option>6 months</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Simulation Intensity</p>
                  <select className="w-full px-3 py-2 rounded-md border border-primary/20 text-sm bg-background">
                    <option>Light (3 hrs/week)</option>
                    <option>Moderate (10 hrs/week)</option>
                    <option>Intensive (20+ hrs/week)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button size="lg" className="flex-1 gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate Hyper-Path
                </Button>
                <Button size="lg" variant="outline">
                  View Examples
                </Button>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-1">💡 Hyper-Paths Include:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Structured learning modules with AI tutoring</li>
                  <li>Interactive real-world simulations & case studies</li>
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
                  <p className="text-muted-foreground text-sm mt-1">{recommendations.aiTip}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}