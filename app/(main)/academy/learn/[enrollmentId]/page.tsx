"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUserEnrollments, updateLessonProgress, getLessonProgress } from "@/actions/academy";
import {
  Loader2,
  Play,
  CheckCircle,
  Clock,
  BookOpen,
  Video,
  FileText,
  Lightbulb,
  Trophy,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { motion } from "framer-motion";
import { AIResponseFormatter } from "@/components/ai-response-formatter";

interface Enrollment {
  id: string;
  progress: number;
  currentModuleId: string | null;
  currentLessonId: string | null;
  learningPath: {
    id: string;
    title: string;
    description: string;
    modules: Module[];
  };
}

interface Module {
  id: string;
  title: string;
  order: number;
  description?: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  order: number;
  estimatedMinutes: number | null;
  content?: string;
}

interface LessonProgressItem {
  lessonId: string;
  status: string;
}

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getUserEnrollments();
        setEnrollments(data);

        // Load progress for all enrollments
        const progressPromises = data.map(async (enrollment: Enrollment) => {
          const progress = await getLessonProgress(enrollment.id);
          const map: Record<string, string> = {};
          progress.forEach((p: LessonProgressItem) => {
            map[p.lessonId] = p.status;
          });
          return { enrollmentId: enrollment.id, map };
        });

        const progressResults = await Promise.all(progressPromises);
        const allProgress: Record<string, Record<string, string>> = {};
        progressResults.forEach((result) => {
          allProgress[result.enrollmentId] = result.map;
        });

        const currentEnrollmentProgress = allProgress[params.enrollmentId as string] || {};
        setProgressMap(currentEnrollmentProgress);

        // Set selected module to current or first
        if (data.length > 0) {
          const enrollment = data.find((e) => e.id === params.enrollmentId);
          if (enrollment) {
            setSelectedModule(
              enrollment.currentModuleId || enrollment.learningPath.modules[0]?.id
            );
          }
        }
      } catch (error) {
        console.error("Error loading:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.enrollmentId]);

  const enrollment = enrollments.find((e) => e.id === params.enrollmentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Enrollment not found</p>
        <Link href="/academy" className="text-primary hover:underline mt-2 inline-block">
          Back to Academy
        </Link>
      </div>
    );
  }

  const { learningPath } = enrollment;
  const currentModule = learningPath.modules.find((m) => m.id === selectedModule) || learningPath.modules[0];
  const completedLessons = Object.values(progressMap).filter((s) => s === "COMPLETED").length;
  const totalLessons = learningPath.modules.flatMap((m) => m.lessons).length;

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return <Video className="w-4 h-4" />;
      case "QUIZ":
        return <FileText className="w-4 h-4" />;
      case "ASSIGNMENT":
        return <Lightbulb className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const getLessonColor = (lesson: Lesson) => {
    const status = progressMap[lesson.id];
    if (status === "COMPLETED") return "border-green-200 bg-green-50/50 dark:bg-green-950/20";
    if (lesson.id === enrollment.currentLessonId) return "border-primary/40 bg-primary/5";
    return "border-border/50 hover:border-primary/30";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-blue-950/30">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link href="/academy" className="hover:text-foreground transition-colors">
                  Academy
                </Link>
                <span>/</span>
                <Link href={`/academy/paths/${learningPath.id}`} className="hover:text-foreground transition-colors">
                  {learningPath.title}
                </Link>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
                {learningPath.title}
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="w-4 h-4" />
                  Progress
                </div>
                <p className="text-xl font-bold">{Math.round(enrollment.progress)}%</p>
              </div>
              <Progress value={enrollment.progress} className="w-32 h-2" />
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </div>
                <p className="text-xl font-bold">
                  {completedLessons}/{totalLessons}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Module Navigation Sidebar */}
          <div className="col-span-3">
            <Card className="sticky top-24 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Course Modules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {learningPath.modules.map((module) => {
                  const moduleLessons = module.lessons;
                  const completedInModule = moduleLessons.filter(
                    (l) => progressMap[l.id] === "COMPLETED"
                  ).length;

                  return (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModule(module.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        module.id === selectedModule
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Module {module.order}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            module.id === selectedModule
                              ? "border-primary-foreground/30"
                              : ""
                          }`}
                        >
                          {completedInModule}/{moduleLessons.length}
                        </Badge>
                      </div>
                      <p className={`text-xs mt-1 ${module.id === selectedModule ? "opacity-80" : "text-muted-foreground"}`}>
                        {module.title}
                      </p>
                      {module.id === selectedModule && (
                        <Progress
                          value={(completedInModule / moduleLessons.length) * 100}
                          className="h-1 mt-2"
                        />
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Lessons */}
          <div className="col-span-9">
            {currentModule && (
              <motion.div
                key={currentModule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-primary/20 mb-6">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-primary to-cyan-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                        {currentModule.order}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{currentModule.title}</CardTitle>
                        {currentModule.description && (
                          <CardDescription className="mt-1">{currentModule.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {currentModule.lessons.length} lessons
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                <div className="space-y-3">
                  {currentModule.lessons
                    .sort((a, b) => a.order - b.order)
                    .map((lesson, index) => {
                      const isCompleted = progressMap[lesson.id] === "COMPLETED";
                      const isCurrent = lesson.id === enrollment.currentLessonId;
                      const isLocked = index > 0 && progressMap[currentModule.lessons[index - 1].id] !== "COMPLETED";

                      return (
                        <motion.div
                          key={lesson.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card
                            className={`transition-all cursor-pointer ${getLessonColor(lesson)} ${
                              isLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            onClick={() => !isLocked && router.push(`/academy/learn/${enrollment.id}/lesson/${lesson.id}`)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                {/* Lesson Number/Status */}
                                <div className="flex-shrink-0">
                                  {isCompleted ? (
                                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                      <CheckCircle className="w-5 h-5 text-white" />
                                    </div>
                                  ) : isCurrent ? (
                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-pulse">
                                      <Play className="w-5 h-5 text-white" />
                                    </div>
                                  ) : isLocked ? (
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center font-semibold text-primary">
                                      {index + 1}
                                    </div>
                                  )}
                                </div>

                                {/* Lesson Info */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className={`font-semibold ${isCompleted ? "text-green-700 dark:text-green-400" : ""}`}>
                                      {lesson.title}
                                    </h3>
                                    {isCurrent && (
                                      <Badge className="bg-primary text-xs">Current</Badge>
                                    )}
                                    {isCompleted && (
                                      <Badge className="bg-green-500 text-xs">Completed</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      {getLessonIcon(lesson.type)}
                                      <span>{lesson.type}</span>
                                    </div>
                                    {lesson.estimatedMinutes && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{lesson.estimatedMinutes} min</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action */}
                                <div className="flex-shrink-0">
                                  {!isLocked ? (
                                    <Button
                                      size="sm"
                                      variant={isCurrent ? "default" : "outline"}
                                      className="gap-2"
                                    >
                                      {isCompleted ? (
                                        <>
                                          <TrendingUp className="w-4 h-4" />
                                          Review
                                        </>
                                      ) : isCurrent ? (
                                        <>
                                          <Play className="w-4 h-4" />
                                          Continue
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-4 h-4" />
                                          Start
                                        </>
                                      )}
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" disabled className="gap-2">
                                      <BookOpen className="w-4 h-4" />
                                      Locked
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                </div>

                {/* Module Preview - Other Modules */}
                {learningPath.modules.length > 1 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Other Modules in this Course
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningPath.modules
                        .filter((m) => m.id !== currentModule.id)
                        .map((module) => {
                          const completedInModule = module.lessons.filter(
                            (l) => progressMap[l.id] === "COMPLETED"
                          ).length;

                          return (
                            <Card
                              key={module.id}
                              className="cursor-pointer hover:border-primary/40 transition-colors"
                              onClick={() => setSelectedModule(module.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-primary/10 p-3 rounded-lg">
                                    <span className="text-lg font-bold text-primary">
                                      {module.order}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium">{module.title}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                      <span>{module.lessons.length} lessons</span>
                                      <span>•</span>
                                      <span>{completedInModule} completed</span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
