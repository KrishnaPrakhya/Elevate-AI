"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, TrendingUp, Briefcase, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface CareerSessionProps {
  userId: string;
  industry: string;
  skills: string[];
  experience: number;
}

interface CareerInsight {
  skillGaps: { skill: string; importance: number }[];
  marketTrends: { trend: string; impact: string; description: string }[];
  recommendedActions: {
    type: string;
    title: string;
    description: string;
    priority: string;
  }[];
  careerPathSuggestions: { role: string; matchScore: number; skillsNeeded: string[] }[];
}

export default function CareerSession({ industry, skills, experience }: CareerSessionProps) {
  const [insight, setInsight] = useState<CareerInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch("/api/career-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            industry,
            skills,
            experience,
          }),
        });
        const data = await response.json();
        setInsight(data);
      } catch (error) {
        console.error("Error fetching career insights:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [industry, skills, experience]);

  if (loading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardContent className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-muted-foreground">AI is analyzing your career profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!insight) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Market Trends */}
      {insight.marketTrends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {insight.marketTrends.map((trend, idx) => (
            <Card
              key={idx}
              className={`border-l-4 ${
                trend.impact === "positive"
                  ? "border-l-green-500"
                  : trend.impact === "negative"
                  ? "border-l-red-500"
                  : "border-l-yellow-500"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {trend.trend}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{trend.description}</p>
                <Badge
                  variant="outline"
                  className="mt-2 text-xs"
                >
                  {trend.impact} impact
                </Badge>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Priority Actions */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-blue-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Priority Actions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI-recommended steps to accelerate your career
                </p>
              </div>
            </div>
            <Badge className="gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {insight.recommendedActions.slice(0, 4).map((action, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-3 rounded-lg bg-background/50 border border-border/50 flex items-center justify-between"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className={`mt-0.5 w-2 h-2 rounded-full ${
                  action.priority === "high" ? "bg-red-500" :
                  action.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                }`} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </div>
              <Badge variant={action.priority === "high" ? "default" : "secondary"}>
                {action.priority}
              </Badge>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Career Paths */}
      {insight.careerPathSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <Briefcase className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Suggested Career Paths</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Roles that match your profile and goals
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insight.careerPathSuggestions.map((path, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 rounded-lg border border-border/50 bg-gradient-to-br from-background to-purple-500/5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{path.role}</h4>
                    <Badge variant="outline" className="text-xs">
                      {path.matchScore}% match
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Skills needed:</p>
                    <div className="flex flex-wrap gap-1">
                      {path.skillsNeeded.slice(0, 3).map((skill, sIdx) => (
                        <Link
                          key={sIdx}
                          href={`/academy/paths?search=${encodeURIComponent(skill)}`}
                        >
                          <Badge
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                          >
                            {skill}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Link href={`/chatbot?role=${encodeURIComponent(path.role)}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 h-8 text-xs gap-1"
                    >
                      Explore Path
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
