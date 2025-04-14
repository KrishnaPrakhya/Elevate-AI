"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { assessmentsProps } from "./stats-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import QuizResult from "./quiz-result";
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";

function QuizList(assessments: assessmentsProps) {
  const assessmentsReview = assessments.assessments;
  const router = useRouter();
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);

  return (
    <Card className="overflow-hidden border-t-4 border-t-purple-500 transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-purple-500" />
              <CardTitle>Recent Quizzes</CardTitle>
            </div>
            <CardDescription>
              Review your past quiz performance and track your progress
            </CardDescription>
          </div>
          <Button
            onClick={() => router.push("/interview/mockQuiz")}
            className="group relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start New Quiz
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300"></span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="space-y-4">
          {assessmentsReview.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No quizzes yet</h3>
              <p className="text-muted-foreground mb-6">
                Take your first quiz to start tracking your progress
              </p>
              <Button
                onClick={() => router.push("/interview/mockQuiz")}
                variant="outline"
                className="gap-2"
              >
                Start Your First Quiz
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            assessmentsReview.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card
                  onClick={() => setSelectedQuiz(item)}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-purple-500/30 group"
                >
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-purple-500">
                            {item.quizScore.toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium group-hover:text-purple-500 transition-colors">
                            Quiz {index + 1}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="text-xs flex items-center gap-1"
                            >
                              <Calendar className="h-3 w-3" />
                              {format(new Date(item.createdAt), "MMM d, yyyy")}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs flex items-center gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              {format(new Date(item.createdAt), "h:mm a")}
                            </Badge>
                            <Badge
                              className={`text-xs ${
                                item.quizScore >= 80
                                  ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                  : item.quizScore >= 60
                                  ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                  : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                              }`}
                            >
                              {item.quizScore >= 80
                                ? "Excellent"
                                : item.quizScore >= 60
                                ? "Good"
                                : "Needs Improvement"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Button variant="ghost" size="sm" className="gap-1">
                          View Details
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </div>
                    {item.improvementTip && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg border text-sm">
                        <p className="text-muted-foreground">
                          {item.improvementTip}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={!!selectedQuiz} onOpenChange={() => setSelectedQuiz(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Quiz Results
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of your quiz performance
            </DialogDescription>
          </DialogHeader>
          <QuizResult
            result={selectedQuiz}
            onStartNew={() => router.push("/interview/mockQuiz")}
            hideStartNew
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default QuizList;
