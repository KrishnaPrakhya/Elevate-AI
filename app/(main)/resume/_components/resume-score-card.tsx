"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, BarChart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeScoreCardProps {
  score: {
    overall: number;
    sections: {
      name: string;
      score: number;
      feedback: string;
    }[];
    suggestions: any[];
  };
}

export function ResumeScoreCard({ score }: ResumeScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreIndicatorColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 60) return <AlertCircle className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <Card className="shadow-md border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <BarChart className="h-5 w-5 text-primary" />
          Resume Analysis
        </CardTitle>
        <CardDescription>AI-powered feedback on your resume</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-32 h-32 mb-4">
            <div
              className={cn(
                "absolute inset-0 rounded-full border-8 border-muted flex items-center justify-center",
                score.overall >= 80
                  ? "border-t-green-500 border-r-green-500 border-b-green-300"
                  : score.overall >= 60
                  ? "border-t-amber-500 border-r-amber-500 border-b-amber-300"
                  : "border-t-red-500 border-r-red-500 border-b-red-300"
              )}
              style={{ borderRadius: "50%" }}
            >
              <span
                className={cn(
                  "text-3xl font-bold",
                  getScoreColor(score.overall)
                )}
              >
                {score.overall}
              </span>
            </div>
          </div>
          <h3 className="text-lg font-medium mb-1">Overall Score</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {score.overall >= 80
              ? "Excellent! Your resume is well-optimized and ready for applications."
              : score.overall >= 60
              ? "Good start! With a few improvements, your resume will stand out more."
              : "Needs work. Follow our suggestions to significantly improve your resume."}
          </p>
        </div>

        <div className="space-y-4">
          {score.sections.map((section, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getScoreIcon(section.score)}
                  <span className="font-medium">{section.name}</span>
                </div>
                <span
                  className={cn("font-medium", getScoreColor(section.score))}
                >
                  {section.score}/100
                </span>
              </div>
              <Progress
                value={section.score}
                className="h-2"
                indicatorClassName={getScoreIndicatorColor(section.score)}
              />
              <p className="text-sm text-muted-foreground">
                {section.feedback}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t p-4 bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          <span>
            Apply the AI suggestions to improve your score and make your resume
            more effective.
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
