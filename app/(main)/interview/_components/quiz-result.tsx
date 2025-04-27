"use client";

import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Brain,
  Lightbulb,
  Target,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardFooter,
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface QuizResultProps {
  result: {
    quizScore: number;
    improvementTip?: string;
    questions: {
      question: string;
      isCorrect: boolean;
      userAnswer: string;
      correctAnswer: string;
      explanation: string;
    }[];
  };
  hideStartNew?: boolean;
  onStartNew?: () => void;
}
interface QuizQuestionResult {
  question: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export default function QuizResult({
  result,
  hideStartNew = false,
  onStartNew,
}: QuizResultProps) {
  if (!result) return null;
  console.log(result);
  // Calculate stats
  const totalQuestions = result.questions.length;
  const correctAnswers = result.questions.filter((q) => q.isCorrect).length;
  const incorrectAnswers = totalQuestions - correctAnswers;
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      className="mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-center mb-6">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              result.quizScore >= 80
                ? "bg-green-500/10 text-green-500 border-2 border-green-500/30"
                : result.quizScore >= 60
                ? "bg-amber-500/10 text-amber-500 border-2 border-amber-500/30"
                : "bg-red-500/10 text-red-500 border-2 border-red-500/30"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold">
                {result.quizScore.toFixed(0)}%
              </div>
              <div className="text-xs">Score</div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Correct Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {correctAnswers} / {totalQuestions}
            </div>
            <Progress
              value={(correctAnswers / totalQuestions) * 100}
              className="mt-2 bg-green-500/20"
              indicatorClassName="bg-green-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Incorrect Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incorrectAnswers} / {totalQuestions}
            </div>
            <Progress
              value={(incorrectAnswers / totalQuestions) * 100}
              className="mt-2 bg-red-500/20"
              indicatorClassName="bg-red-500"
            />
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {result.quizScore >= 80
                ? "Excellent"
                : result.quizScore >= 60
                ? "Good"
                : "Needs Work"}
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < Math.ceil(result.quizScore / 20)
                      ? "bg-blue-500"
                      : "bg-blue-500/20"
                  }`}
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Improvement Tip */}
      {result.improvementTip && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Improvement Tip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{result.improvementTip}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Questions Review */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Question Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.questions.map((q: QuizQuestionResult, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card
                  className={`border ${
                    q.isCorrect ? "border-green-500/30" : "border-red-500/30"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-medium">
                        {q.question}
                      </CardTitle>
                      {q.isCorrect ? (
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                          Correct
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">
                          Incorrect
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="text-sm p-3 rounded-lg bg-muted/50 border">
                        <p className="font-medium mb-1">Your answer:</p>
                        <p
                          className={
                            q.isCorrect ? "text-green-600" : "text-red-600"
                          }
                        >
                          {q.userAnswer}
                        </p>
                      </div>

                      {!q.isCorrect && (
                        <div className="text-sm p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                          <p className="font-medium mb-1">Correct answer:</p>
                          <p className="text-green-600">{q.correctAnswer}</p>
                        </div>
                      )}
                    </div>

                    <div className="text-sm p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="font-medium mb-1 flex items-center gap-1">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Explanation:
                      </p>
                      <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {!hideStartNew && (
        <motion.div variants={itemVariants}>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Target className="h-10 w-10 text-primary mx-auto" />
                <h3 className="text-xl font-bold">
                  Ready for another challenge?
                </h3>
                <p className="text-muted-foreground">
                  Regular practice is the key to interview success. Try another
                  quiz to improve your skills.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={onStartNew}
                className="w-full group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start New Quiz
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300"></span>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
