"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getUserEnrollments, updateLessonProgress, getLessonProgress } from "@/actions/academy";
import { Loader2, Play, CheckCircle, Clock, ChevronRight, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  order: number;
  estimatedMinutes: number | null;
}

interface LessonProgressItem {
  lessonId: string;
  status: string;
}

export default function LearnPage() {
  const params = useParams();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

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
        setProgressMap(allProgress[params.enrollmentId as string] || {});
      } catch (error) {
        console.error("Error loading:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.enrollmentId]);

  const enrollment = enrollments.find((e) => e.id === params.enrollmentId);

  const handleMarkComplete = async (lessonId: string) => {
    setCompleting(lessonId);
    try {
      await updateLessonProgress(params.enrollmentId as string, lessonId, "COMPLETED");
      setProgressMap((prev) => ({ ...prev, [lessonId]: "COMPLETED" }));
    } catch (error) {
      console.error("Error completing lesson:", error);
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
  const currentModuleIndex = learningPath.modules.findIndex(
    (m) => m.id === enrollment.currentModuleId
  );
  const currentModule = learningPath.modules[currentModuleIndex] || learningPath.modules[0];

  const getLessonStatusIcon = (lesson: Lesson) => {
    const status = progressMap[lesson.id];
    if (status === "COMPLETED") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (lesson.type === "VIDEO") return <Play className="w-5 h-5 text-primary" />;
    return <BookOpen className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/academy" className="hover:text-foreground">Academy</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/academy/paths/${learningPath.id}`} className="hover:text-foreground">
              {learningPath.title}
            </Link>
          </div>
          <h1 className="text-3xl font-bold">{learningPath.title}</h1>
          <p className="text-muted-foreground mt-1">{learningPath.description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="text-2xl font-bold">{Math.round(enrollment.progress)}%</p>
          <Progress value={enrollment.progress} className="w-32 h-2 mt-2" />
        </div>
      </div>

      {/* Module Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {learningPath.modules.map((module, index) => (
          <Badge
            key={module.id}
            variant={module.id === currentModule?.id ? "default" : "secondary"}
            className={`px-4 py-2 cursor-pointer ${
              module.id === currentModule?.id ? "bg-primary" : ""
            }`}
          >
            Module {index + 1}: {module.title}
          </Badge>
        ))}
      </div>

      {/* Current Module Lessons */}
      {currentModule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                {currentModule.order}
              </span>
              {currentModule.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentModule.lessons
              .sort((a, b) => a.order - b.order)
              .map((lesson) => {
                const isCompleted = progressMap[lesson.id] === "COMPLETED";
                const isCurrent = lesson.id === enrollment.currentLessonId;

                return (
                  <div
                    key={lesson.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      isCompleted
                        ? "bg-green-50 border-green-200"
                        : isCurrent
                        ? "bg-primary/5 border-primary/30"
                        : "bg-gray-50 border-gray-200 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex-shrink-0">{getLessonStatusIcon(lesson)}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${isCompleted ? "text-green-700" : ""}`}>
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {lesson.type}
                        </Badge>
                        {lesson.estimatedMinutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lesson.estimatedMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    {isCompleted ? (
                      <Badge className="bg-green-500">Completed</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleMarkComplete(lesson.id)}
                        disabled={completing === lesson.id}
                        className="gap-2"
                      >
                        {completing === lesson.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Mark Complete
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Other Modules Preview */}
      {learningPath.modules.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Other Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learningPath.modules
              .filter((m) => m.id !== currentModule?.id)
              .map((module) => (
                <Card key={module.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <span className="text-lg font-bold text-primary">{module.order}</span>
                      </div>
                      <div>
                        <p className="font-medium">{module.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {module.lessons.length} lessons
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}