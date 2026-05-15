"use client";

import { useEffect, useState } from "react";
import { getLearningPaths } from "@/actions/academy";
import { Loader2, BookOpen, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface LearningPath {
  id: string;
  title: string;
  description: string;
  industry: string | null;
  level: string;
  icon: string | null;
  estimatedHours: number | null;
  modules: { id: string }[];
  _count: { enrollments: number };
}

interface Enrollment {
  id: string;
  learningPathId: string;
  progress: number;
  learningPath: LearningPath;
}

export default function PathsPage() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "enrolled" | "available">("all");

  useEffect(() => {
    async function load() {
      try {
        const [pathsData] = await Promise.all([
          getLearningPaths(),
          // getUserEnrollments() - we'll need a separate call
        ]);
        setPaths(pathsData);
        // For now we'll use an empty array, enhanced later
        setEnrollments([]);
      } catch (error) {
        console.error("Error loading paths:", error);
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

  const enrolledPathIds = new Set(enrollments.map((e) => e.learningPathId));

  const filteredPaths = paths.filter((path) => {
    if (filter === "enrolled") return enrolledPathIds.has(path.id);
    if (filter === "available") return !enrolledPathIds.has(path.id);
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "BEGINNER":
        return "bg-green-100 text-green-800";
      case "INTERMEDIATE":
        return "bg-yellow-100 text-yellow-800";
      case "ADVANCED":
        return "bg-orange-100 text-orange-800";
      case "EXPERT":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Learning Paths</h1>
          <p className="text-muted-foreground">
            Master your skills with structured learning
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All Paths
        </button>
        <button
          onClick={() => setFilter("enrolled")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "enrolled"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Enrolled
        </button>
        <button
          onClick={() => setFilter("available")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "available"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Available
        </button>
      </div>

      {/* Paths Grid */}
      {filteredPaths.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No learning paths found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPaths.map((path) => {
            const enrollment = enrollments.find(
              (e) => e.learningPathId === path.id,
            );
            const isEnrolled = enrolledPathIds.has(path.id);

            return (
              <Card
                key={path.id}
                className="hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="h-2 bg-gradient-to-r from-primary to-primary/50" />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{path.title}</CardTitle>
                      {path.industry && (
                        <Badge variant="outline" className="mt-2">
                          {path.industry}
                        </Badge>
                      )}
                    </div>
                    <Badge className={getLevelColor(path.level)}>
                      {path.level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {path.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{path.modules?.length || 0} modules</span>
                    </div>
                    {path.estimatedHours && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{path.estimatedHours}h</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{path._count?.enrollments || 0}</span>
                    </div>
                  </div>

                  {isEnrolled && enrollment && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{Math.round(enrollment.progress)}%</span>
                      </div>
                      <Progress value={enrollment.progress} className="h-2" />
                    </div>
                  )}

                  <Link
                    href={
                      isEnrolled && enrollment
                        ? `/academy/learn/${enrollment.id}`
                        : `/academy/paths/${path.id}`
                    }
                    className={`block text-center py-2 rounded-lg font-medium transition-colors ${
                      isEnrolled
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isEnrolled && enrollment
                      ? "Continue Learning"
                      : "View Path"}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
