"use client";

import { useEffect, useState } from "react";
import { getAcademyDashboard, getPersonalizedRecommendations } from "@/actions/academy";
import { Loader2, BookOpen, Trophy, Flame, Target, TrendingUp, Play, Award, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

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

  const { stats } = dashboard || { stats: { currentStreak: 0, weeklyGoalProgress: 0, totalPoints: 0, totalLessonsCompleted: 0, totalAssignmentsCompleted: 0 } };
  const hasActivity = dashboard?.enrollments && dashboard.enrollments.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Academy</h1>
          <p className="text-muted-foreground">Your personalized learning hub</p>
        </div>
        <Link
          href="/academy/paths"
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Browse Paths
        </Link>
      </motion.div>

      {/* Empty State - No Activity Yet */}
      {!hasActivity ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <Card className="col-span-full lg:col-span-2 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <TrendingUp className="w-6 h-6 text-primary" />
                Start Your Learning Journey
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                ElevateAI Academy helps you master new skills with structured learning paths,
                daily goals, achievements, and peer support. Your career acceleration starts here.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Structured Paths</p>
                    <p className="text-sm text-muted-foreground">Learn step by step</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
                  <div className="bg-orange-500/10 p-3 rounded-lg">
                    <Flame className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Daily Streaks</p>
                    <p className="text-sm text-muted-foreground">Build habits</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50">
                  <div className="bg-yellow-500/10 p-3 rounded-lg">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Achievements</p>
                    <p className="text-sm text-muted-foreground">Earn rewards</p>
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <Link href="/academy/paths">
                  <Button size="lg" className="gap-2">
                    <Play className="w-4 h-4" />
                    Explore Learning Paths
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Top Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["🎯 First Steps", "🔥 Week Warrior", "📚 Fast Learner", "💎 Month Master"].map((achievement) => (
                  <div key={achievement} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{achievement}</span>
                  </div>
                ))}
              </div>
              <Link href="/academy/achievements" className="text-sm text-primary hover:underline mt-4 inline-block">
                View all achievements →
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* AI Recommendation */}
          {recommendations?.aiTip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">AI Learning Tip</p>
                      <p className="text-muted-foreground">{recommendations.aiTip}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-orange-500/20 p-3 rounded-lg">
                    <Flame className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats?.currentStreak || 0}</p>
                    <p className="text-sm text-muted-foreground">Day Streak</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500/20 p-3 rounded-lg">
                    <Target className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl font-bold">{Math.round(stats?.weeklyGoalProgress || 0)}%</p>
                    <p className="text-sm text-muted-foreground">Today&apos;s Goal</p>
                    <Progress value={stats?.weeklyGoalProgress || 0} className="h-2 mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-purple-500/20 p-3 rounded-lg">
                    <Trophy className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats?.totalPoints || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/20 p-3 rounded-lg">
                    <BookOpen className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats?.totalLessonsCompleted || 0}</p>
                    <p className="text-sm text-muted-foreground">Lessons Done</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Continue Learning */}
          {dashboard?.enrollments && dashboard.enrollments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold mb-4">Continue Learning</h2>
              <div className="grid gap-4">
                {dashboard.enrollments.slice(0, 3).map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{enrollment.learningPath.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.learningPath.modules?.length || 0} modules
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={enrollment.progress} className="h-2 flex-1 max-w-xs" />
                            <span className="text-sm text-muted-foreground">
                              {Math.round(enrollment.progress)}%
                            </span>
                          </div>
                        </div>
                        <Link href={`/academy/learn/${enrollment.id}`}>
                          <Button variant="outline" className="gap-2">
                            <Play className="w-4 h-4" />
                            Continue
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recommended Paths */}
          {recommendations?.recommendedPaths && recommendations.recommendedPaths.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold mb-4">Recommended for You</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendations.recommendedPaths.map((path) => (
                  <Card key={path.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{path.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {path.description}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant="secondary">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {path.modules?.length || 0} modules
                        </Badge>
                        <Link href={`/academy/paths/${path.id}`} className="text-primary text-sm hover:underline">
                          Explore →
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Link href="/academy/paths">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium">Browse Paths</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/academy/streak">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Flame className="w-8 h-8 mx-auto text-orange-500 mb-2" />
              <p className="font-medium">View Streak</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/academy/achievements">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
              <p className="font-medium">Achievements</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/academy/leaderboard">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <p className="font-medium">Leaderboard</p>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    </div>
  );
}