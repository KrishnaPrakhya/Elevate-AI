"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Flame, Trophy, Users, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AcademyOnboardingCardProps {
  userName?: string;
}

export default function AcademyOnboardingCard({ userName }: AcademyOnboardingCardProps) {
  const features = [
    {
      icon: BookOpen,
      title: "Structured Learning Paths",
      description: "Master skills with guided courses",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Flame,
      title: "Daily Streaks & Goals",
      description: "Build consistent learning habits",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: Trophy,
      title: "Achievements & Points",
      description: "Earn badges as you progress",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      icon: Users,
      title: "Learning Cohorts",
      description: "Learn together with peers",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Welcome to Academy{userName ? `, ${userName}` : ""}!
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your personalized learning hub to accelerate your career
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50"
              >
                <div className={`p-2 rounded-lg ${feature.bg}`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="pt-4 border-t">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    You&apos;re all set!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    After completing your profile, you&apos;ll be automatically enrolled in personalized learning paths based on your industry.
                  </p>
                </div>
              </div>
            </div>
          
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}