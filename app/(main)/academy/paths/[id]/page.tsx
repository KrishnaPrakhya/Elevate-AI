"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getLearningPath, enrollInPath, getUserEnrollments } from "@/actions/academy";
import { Loader2, BookOpen, Clock, Users, CheckCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  modules: Module[];
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedHours: number | null;
  lessons: Lesson[];
  assignments: Assignment[];
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  order: number;
  estimatedMinutes: number | null;
}

interface Assignment {
  id: string;
  title: string;
  dueDate: string | null;
}

interface Enrollment {
  id: string;
  learningPathId: string;
  progress: number;
}

export default function PathDetailPage() {
  const params = useParams();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [pathData, enrollmentsData] = await Promise.all([
          getLearningPath(params.id as string),
          getUserEnrollments(),
        ]);
        setPath(pathData);
        const userEnrollment = enrollmentsData.find(
          (e) => e.learningPathId === params.id
        );
        setEnrollment(userEnrollment || null);
      } catch (error) {
        console.error("Error loading path:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const newEnrollment = await enrollInPath(params.id as string);
      setEnrollment(newEnrollment);
    } catch (error) {
      console.error("Error enrolling:", error);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Learning path not found</p>
        <Link href="/academy/paths" className="text-primary hover:underline mt-2 inline-block">
          Back to Paths
        </Link>
      </div>
    );
  }

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

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return <PlayCircle className="w-4 h-4" />;
      case "QUIZ":
      case "ASSIGNMENT":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{path.title}</h1>
            <Badge className={getLevelColor(path.level)}>{path.level}</Badge>
          </div>
          {path.industry && (
            <Badge variant="outline" className="mb-2">
              {path.industry}
            </Badge>
          )}
          <p className="text-muted-foreground max-w-2xl">{path.description}</p>
        </div>
        {enrollment ? (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Your Progress</p>
            <p className="text-2xl font-bold">{Math.round(enrollment.progress)}%</p>
            <Progress value={enrollment.progress} className="w-32 h-2 mt-2" />
          </div>
        ) : (
          <Button onClick={handleEnroll} disabled={enrolling} size="lg">
            {enrolling ? "Enrolling..." : "Enroll Now"}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{path.modules?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Modules</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{path.estimatedHours || "—"}</p>
              <p className="text-sm text-muted-foreground">Estimated Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {path.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total Lessons</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Course Content</h2>
        {path.modules?.map((module, index) => (
          <Card key={module.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <CardTitle>{module.title}</CardTitle>
                  {module.estimatedHours && (
                    <p className="text-sm text-muted-foreground">
                      {module.estimatedHours} hours
                    </p>
                  )}
                </div>
                <Badge variant="secondary">
                  {module.lessons?.length || 0} lessons
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{module.description}</p>
              <div className="space-y-2">
                {module.lessons?.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-muted-foreground">
                      {getLessonIcon(lesson.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{lesson.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {lesson.type}
                        </Badge>
                        {lesson.estimatedMinutes && (
                          <span>{lesson.estimatedMinutes} min</span>
                        )}
                      </div>
                    </div>
                    {enrollment && (
                      <Link
                        href={`/academy/learn/${enrollment.id}/lesson/${lesson.id}`}
                        className="text-primary text-sm hover:underline"
                      >
                        {lesson.type === "VIDEO" ? "Watch" : "Start"}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              {module.assignments?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">Assignments</h4>
                  {module.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{assignment.title}</span>
                      </div>
                      {assignment.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      {!enrollment && (
        <div className="bg-primary/5 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Ready to start learning?</h3>
          <p className="text-muted-foreground mb-4">
            Enroll now and start your journey to mastering {path.title}
          </p>
          <Button onClick={handleEnroll} disabled={enrolling} size="lg">
            {enrolling ? "Enrolling..." : "Enroll Now"}
          </Button>
        </div>
      )}
    </div>
  );
}