import { getDashboardInsights } from "@/actions/dashboard";
import { getOnboardingStatus, getUser } from "@/actions/user";
import { getAcademyDashboard } from "@/actions/academy";
import { getUserLearningSummary } from "@/lib/integrations/academy-career-bridge";
import { analyzeCareerProfile, CareerInsight } from "@/lib/ai/career-agent";
import { redirect } from "next/navigation";
import React from "react";
import DashBoardView, { IndustryInsights } from "./_components/DashBoardView";
import { IndustryInsight } from "@prisma/client";
import { Flame, BookOpen, Trophy, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export interface SalaryRange {
  role: string;
  min: number;
  max: number;
  median: number;
  location: string;
}

export interface DashboardInsights
  extends Omit<IndustryInsight, "salaryRanges"> {
  salaryRanges: SalaryRange[];
}

async function Page() {
  const { isOnBoardingStatus } = await getOnboardingStatus();
  if (!isOnBoardingStatus) redirect("/onboarding");

  const [rawInsights, academyData, learningSummary, user] = await Promise.all([
    getDashboardInsights(),
    getAcademyDashboard().catch(() => null),
    getUserLearningSummary().catch(() => null),
    getUser().catch(() => null),
  ]);

  // Generate AI-powered career insights
  let careerInsight: CareerInsight | null = null;
  if (user) {
    careerInsight = await analyzeCareerProfile(
      {
        industry: user.industry,
        experience: user.experience,
        skills: user.skills || [],
        bio: user.bio,
      },
      {
        recentActivity: learningSummary ? `Completed ${learningSummary.activeEnrollments} courses` : undefined,
      }
    ).catch(() => null);
  }

  const insights: IndustryInsights = {
    ...rawInsights,
    salaryRanges: (rawInsights.salaryRanges as unknown as SalaryRange[]).filter(
      Boolean
    ),
  };

  const hasActiveEnrollment = learningSummary && learningSummary.activeEnrollments > 0;

  return (
    <div className="container mx-auto">
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
                    Next: {learningSummary.nextLesson.title} in {learningSummary.nextLesson.pathTitle}
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
              <Link href={`/academy/learn/${learningSummary.nextLesson.enrollmentId}`}>
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
                <p className="text-2xl font-bold">{academyData.stats.currentStreak}</p>
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
                <p className="text-2xl font-bold">{academyData.stats.totalLessonsCompleted}</p>
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
                <p className="text-2xl font-bold">{academyData.stats.totalPoints}</p>
                <p className="text-sm text-muted-foreground">Achievement Points</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-500/20 p-3 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{academyData.enrollments?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Active Courses</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DashBoardView insights={insights} careerInsight={careerInsight} userId={user?.id} />
    </div>
  );
}

export default Page;
