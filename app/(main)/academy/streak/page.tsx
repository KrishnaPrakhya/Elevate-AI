"use client";

import { useEffect, useState } from "react";
import { getUserStreak, getTodayGoal, updateDailyGoal } from "@/actions/academy";
import { Loader2, Flame, Target, Calendar, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  weeklyGoalMet: number;
  monthlyGoalMet: number;
  totalDaysActive: number;
}

interface DailyGoal {
  id: string;
  targetMinutes: number;
  actualMinutes: number;
  lessonsCompleted: number;
  assignmentsCompleted: number;
  quizzesCompleted: number;
}

export default function StreakPage() {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [todayGoal, setTodayGoal] = useState<DailyGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingActivity, setLoggingActivity] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [streakData, goalData] = await Promise.all([
          getUserStreak(),
          getTodayGoal(),
        ]);
        setStreak(streakData);
        setTodayGoal(goalData);
      } catch (error) {
        console.error("Error loading streak data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleLogActivity = async (minutes: number) => {
    setLoggingActivity(true);
    try {
      const updated = await updateDailyGoal({
        actualMinutes: minutes,
        lessonsCompleted: todayGoal ? todayGoal.lessonsCompleted + 1 : 1,
      });
      setTodayGoal(updated);
    } catch (error) {
      console.error("Error logging activity:", error);
    } finally {
      setLoggingActivity(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const progressPercent = todayGoal
    ? Math.min((todayGoal.actualMinutes / todayGoal.targetMinutes) * 100, 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Streak & Goals</h1>
        <p className="text-muted-foreground">Track your daily learning progress</p>
      </div>

      {/* Streak Card */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="bg-orange-500 p-4 rounded-full">
                <Flame className="w-12 h-12 text-white" />
              </div>
              <div>
                <p className="text-5xl font-bold text-orange-600">
                  {streak?.currentStreak || 0}
                </p>
                <p className="text-lg text-muted-foreground">Day Streak</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold">{streak?.longestStreak || 0}</p>
                <p className="text-sm text-muted-foreground">Longest Streak</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{streak?.totalDaysActive || 0}</p>
                <p className="text-sm text-muted-foreground">Total Days</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Goal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Today&apos;s Goal
            </CardTitle>
            {todayGoal && progressPercent >= 100 && (
              <span className="text-green-600 font-medium text-sm">✓ Goal Achieved!</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {todayGoal?.actualMinutes || 0} / {todayGoal?.targetMinutes || 30} minutes
              </span>
              <span className="text-sm font-medium">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-4" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">
                {todayGoal?.lessonsCompleted || 0}
              </p>
              <p className="text-sm text-muted-foreground">Lessons</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {todayGoal?.assignmentsCompleted || 0}
              </p>
              <p className="text-sm text-muted-foreground">Assignments</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-600">
                {todayGoal?.quizzesCompleted || 0}
              </p>
              <p className="text-sm text-muted-foreground">Quizzes</p>
            </div>
          </div>

          <h3 className="font-medium mb-3">Quick Log Activity</h3>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => handleLogActivity(15)}
              disabled={loggingActivity}
            >
              15 min
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLogActivity(30)}
              disabled={loggingActivity}
            >
              30 min
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLogActivity(45)}
              disabled={loggingActivity}
            >
              45 min
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLogActivity(60)}
              disabled={loggingActivity}
            >
              1 hour
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Achievements Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Weekly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Weekly Goal Met</span>
                <span className="font-medium">{streak?.weeklyGoalMet || 0} weeks</span>
              </div>
              <Progress value={(streak?.weeklyGoalMet || 0) * 10} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Monthly Goal Met</span>
                <span className="font-medium">{streak?.monthlyGoalMet || 0} months</span>
              </div>
              <Progress value={(streak?.monthlyGoalMet || 0) * 10} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 mb-2">🔥 Streak Tips</h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• Set a daily reminder at your preferred learning time</li>
            <li>• Start with just 15 minutes to build the habit</li>
            <li>• Complete small lessons before longer study sessions</li>
            <li>• Your streak resets at midnight - log activity before then!</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}