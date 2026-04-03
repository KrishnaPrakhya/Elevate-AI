"use client";

import { useEffect, useState } from "react";
import { getAchievements, getUserAchievements } from "@/actions/academy";
import { Loader2, Trophy, Star, Zap, Target, Award, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  threshold: number;
}

interface UserAchievement {
  id: string;
  earnedAt: Date | string;
  progress: number;
  achievement: Achievement;
}

export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [allData, userData] = await Promise.all([
          getAchievements(),
          getUserAchievements(),
        ]);
        setAllAchievements(allData);
        setUserAchievements(userData);
      } catch (error) {
        console.error("Error loading achievements:", error);
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

  const earnedIds = new Set(userAchievements.map((ua) => ua.achievement.id));
  const totalPoints = userAchievements.reduce((acc, ua) => acc + ua.achievement.points, 0);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "LEARNING":
        return <BookOpen className="w-5 h-5" />;
      case "STREAK":
        return <Zap className="w-5 h-5" />;
      case "ASSIGNMENT":
        return <Target className="w-5 h-5" />;
      case "QUIZ":
        return <Star className="w-5 h-5" />;
      case "MILESTONE":
        return <Trophy className="w-5 h-5" />;
      case "COMMUNITY":
        return <Award className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "LEARNING":
        return "bg-blue-100 text-blue-700";
      case "STREAK":
        return "bg-orange-100 text-orange-700";
      case "ASSIGNMENT":
        return "bg-green-100 text-green-700";
      case "QUIZ":
        return "bg-purple-100 text-purple-700";
      case "MILESTONE":
        return "bg-yellow-100 text-yellow-700";
      case "COMMUNITY":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Achievements</h1>
          <p className="text-muted-foreground">Track your accomplishments and unlock rewards</p>
        </div>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalPoints}</p>
              <p className="text-sm text-muted-foreground">Total Points</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earned Achievements */}
      {userAchievements.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Earned ({userAchievements.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userAchievements.map((ua) => (
              <Card key={ua.id} className="border-2 border-yellow-200 bg-yellow-50/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{ua.achievement.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{ua.achievement.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ua.achievement.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={getCategoryColor(ua.achievement.category)}>
                          {ua.achievement.category}
                        </Badge>
                        <Badge variant="outline">+{ua.achievement.points} pts</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Earned on {new Date(ua.earnedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Achievements */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-muted-foreground" />
          Available ({allAchievements.length - earnedIds.size})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAchievements
            .filter((a) => !earnedIds.has(a.id))
            .map((achievement) => (
              <Card key={achievement.id} className="opacity-80 hover:opacity-100 transition-opacity">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl grayscale">{achievement.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{achievement.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {achievement.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={getCategoryColor(achievement.category)}>
                          {getCategoryIcon(achievement.category)}
                          <span className="ml-1">{achievement.category}</span>
                        </Badge>
                        <Badge variant="outline">+{achievement.points} pts</Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span>0 / {achievement.threshold}</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Achievement Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {["LEARNING", "STREAK", "ASSIGNMENT", "QUIZ", "MILESTONE", "COMMUNITY"].map((cat) => {
              const count = allAchievements.filter((a) => a.category === cat).length;
              const earned = userAchievements.filter(
                (ua) => ua.achievement.category === cat
              ).length;
              return (
                <div key={cat} className="text-center">
                  <div className={`inline-flex p-3 rounded-full ${getCategoryColor(cat)}`}>
                    {getCategoryIcon(cat)}
                  </div>
                  <p className="font-medium mt-2">{cat.toLowerCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    {earned} / {count}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}