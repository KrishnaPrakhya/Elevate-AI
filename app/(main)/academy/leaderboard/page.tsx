"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/actions/academy";
import { Loader2, Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

interface LeaderboardEntry {
  id: string;
  rank: number;
  points: number;
  userId: string;
  user?: {
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

interface Leaderboard {
  id: string;
  type: string;
  period: string;
  startDate: Date | string;
  endDate: Date | string;
  entries: LeaderboardEntry[];
}

export default function LeaderboardPage() {
  const [weekly, setWeekly] = useState<Leaderboard | null>(null);
  const [monthly, setMonthly] = useState<Leaderboard | null>(null);
  const [allTime, setAllTime] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "all">(
    "weekly",
  );

  useEffect(() => {
    async function load() {
      try {
        const [weeklyData, monthlyData, allTimeData] = await Promise.all([
          getLeaderboard("WEEKLY"),
          getLeaderboard("MONTHLY"),
          getLeaderboard("ALL_TIME"),
        ]);
        setWeekly(weeklyData as Leaderboard | null);
        setMonthly(monthlyData as Leaderboard | null);
        setAllTime(allTimeData as Leaderboard | null);
      } catch (error) {
        console.error("Error loading leaderboard:", error);
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

  const currentLeaderboard =
    activeTab === "weekly"
      ? weekly
      : activeTab === "monthly"
        ? monthly
        : allTime;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center font-bold text-muted-foreground">
            {rank}
          </span>
        );
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-50 border-yellow-200";
      case 2:
        return "bg-gray-50 border-gray-200";
      case 3:
        return "bg-amber-50 border-amber-200";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">Compete with fellow learners</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "weekly"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "monthly"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          This Month
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Time
        </button>
      </div>

      {/* Top 3 Podium */}
      {currentLeaderboard && currentLeaderboard.entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* 2nd place */}
          <Card className={`${getRankBg(2)} border-2 text-center pt-6`}>
            <CardContent>
              <div className="flex justify-center mb-2">
                <Medal className="w-12 h-12 text-gray-400" />
              </div>
              <div className="relative w-16 h-16 mx-auto bg-gray-200 rounded-full mb-2 overflow-hidden">
                {currentLeaderboard.entries[1].user?.imageUrl ? (
                  <Image
                    src={currentLeaderboard.entries[1].user.imageUrl}
                    alt={currentLeaderboard.entries[1].user?.name || "User"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                    {currentLeaderboard.entries[1].user?.name?.[0] ||
                      currentLeaderboard.entries[1].user?.email?.[0]}
                  </div>
                )}
              </div>
              <p className="font-semibold">
                {currentLeaderboard.entries[1].user?.name || "Anonymous"}
              </p>
              <p className="text-2xl font-bold text-gray-600">
                {currentLeaderboard.entries[1].points} pts
              </p>
              <Badge className="mt-2">#2</Badge>
            </CardContent>
          </Card>

          {/* 1st place */}
          <Card className={`${getRankBg(1)} border-2 text-center pt-6`}>
            <CardContent>
              <div className="flex justify-center mb-4">
                <Trophy className="w-16 h-16 text-yellow-500" />
              </div>
              <div className="relative w-20 h-20 mx-auto bg-yellow-100 rounded-full mb-2 overflow-hidden border-4 border-yellow-300">
                {currentLeaderboard.entries[0].user?.imageUrl ? (
                  <Image
                    src={currentLeaderboard.entries[0].user.imageUrl}
                    alt={currentLeaderboard.entries[0].user?.name || "User"}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-yellow-600 font-bold text-xl">
                    {currentLeaderboard.entries[0].user?.name?.[0] ||
                      currentLeaderboard.entries[0].user?.email?.[0]}
                  </div>
                )}
              </div>
              <p className="font-semibold">
                {currentLeaderboard.entries[0].user?.name || "Anonymous"}
              </p>
              <p className="text-3xl font-bold text-yellow-600">
                {currentLeaderboard.entries[0].points} pts
              </p>
              <Badge className="mt-2 bg-yellow-500">#1</Badge>
            </CardContent>
          </Card>

          {/* 3rd place */}
          <Card className={`${getRankBg(3)} border-2 text-center pt-6`}>
            <CardContent>
              <div className="flex justify-center mb-2">
                <Award className="w-12 h-12 text-amber-600" />
              </div>
              <div className="relative w-16 h-16 mx-auto bg-amber-100 rounded-full mb-2 overflow-hidden">
                {currentLeaderboard.entries[2].user?.imageUrl ? (
                  <Image
                    src={currentLeaderboard.entries[2].user.imageUrl}
                    alt={currentLeaderboard.entries[2].user?.name || "User"}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-600 font-bold">
                    {currentLeaderboard.entries[2].user?.name?.[0] ||
                      currentLeaderboard.entries[2].user?.email?.[0]}
                  </div>
                )}
              </div>
              <p className="font-semibold">
                {currentLeaderboard.entries[2].user?.name || "Anonymous"}
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {currentLeaderboard.entries[2].points} pts
              </p>
              <Badge className="mt-2 bg-amber-600">#3</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!currentLeaderboard || currentLeaderboard.entries.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No rankings yet. Start learning to climb the leaderboard!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentLeaderboard.entries.slice(3).map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 p-3 rounded-lg ${getRankBg(entry.rank)}`}
                >
                  <div className="w-10 flex justify-center">
                    {getRankIcon(entry.rank + 3)}
                  </div>
                  <div className="relative w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                    {entry.user?.imageUrl ? (
                      <Image
                        src={entry.user.imageUrl}
                        alt={entry.user?.name || "User"}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                        {entry.user?.name?.[0] || entry.user?.email?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {entry.user?.name || "Anonymous"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentLeaderboard.entries.indexOf(entry) + 1} of{" "}
                      {currentLeaderboard.entries.length} learners
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{entry.points}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How Points Work */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">How to Earn Points</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded">
                <span className="text-lg">📚</span>
              </div>
              <div>
                <p className="font-medium">5 pts</p>
                <p className="text-muted-foreground">Per lesson</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-green-100 p-2 rounded">
                <span className="text-lg">✅</span>
              </div>
              <div>
                <p className="font-medium">10 pts</p>
                <p className="text-muted-foreground">Per assignment</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded">
                <span className="text-lg">🏆</span>
              </div>
              <div>
                <p className="font-medium">10 pts</p>
                <p className="text-muted-foreground">Per achievement</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-orange-100 p-2 rounded">
                <span className="text-lg">🔥</span>
              </div>
              <div>
                <p className="font-medium">2 pts</p>
                <p className="text-muted-foreground">Daily streak</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
