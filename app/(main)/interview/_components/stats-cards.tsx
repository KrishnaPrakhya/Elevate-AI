"use client";
import {
  Brain,
  Target,
  Trophy,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
export interface QuizQuestion {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

export interface assessmentsProps {
  assessments: {
    id: string;
    userId: string;
    quizScore: number;
    questions: QuizQuestion[];
    category: string;
    improvementTip?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

function StatsCards(props: assessmentsProps) {
  const { assessments } = props;

  const getAverageScore = () => {
    if (!assessments?.length) return 0;
    const total = assessments.reduce(
      (sum, assessment): number => Number(sum + assessment.quizScore),
      0
    );
    return (total / assessments.length).toFixed(1);
  };

  const getLatestAssessment = () => {
    if (!assessments?.length) return null;
    return assessments[0];
  };

  const getTotalQuestions = () => {
    if (!assessments?.length) return 0;
    return assessments.reduce(
      (sum, assessment) => sum + assessment.questions.length,
      0
    );
  };

  // Calculate improvement
  const getImprovement = () => {
    if (assessments?.length < 2) return { value: 0, positive: true };

    const latest = assessments[0].quizScore;
    const first = assessments[assessments.length - 1].quizScore;
    const improvement = latest - first;

    return {
      value: Math.abs(improvement).toFixed(1),
      positive: improvement >= 0,
    };
  };

  const improvement = getImprovement();

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
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-t-4 border-t-amber-500 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <div className="p-1.5 rounded-full bg-amber-500/20 dark:bg-amber-500/30">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{getAverageScore()}%</div>
              <div className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400">
                Average
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Performance</span>
                <span className="font-medium">{getAverageScore()}%</span>
              </div>
              <Progress
                value={Number(getAverageScore())}
                className="h-2"
                indicatorClassName="bg-amber-500"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-t-4 border-t-purple-500 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Questions Practiced
            </CardTitle>
            <div className="p-1.5 rounded-full bg-purple-500/20 dark:bg-purple-500/30">
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{getTotalQuestions()}</div>
              <div className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 dark:bg-purple-500/30 text-purple-600 dark:text-purple-400">
                Total
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {assessments?.length || 0} quizzes completed
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-t-4 border-t-green-500 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Latest Score</CardTitle>
            <div className="p-1.5 rounded-full bg-green-500/20 dark:bg-green-500/30">
              <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {Number(getLatestAssessment()?.quizScore).toFixed(1) || 0}%
              </div>
              <div className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 dark:bg-green-500/30 text-green-600 dark:text-green-400">
                Recent
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Most recent quiz result
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-t-4 border-t-blue-500 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Improvement</CardTitle>
            <div className="p-1.5 rounded-full bg-blue-500/20 dark:bg-blue-500/30">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{improvement.value}%</div>
              <div
                className={`text-xs px-2 py-0.5 rounded-full ${
                  improvement.positive
                    ? "bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400"
                    : "bg-red-500/20 text-red-600 dark:bg-red-500/30 dark:text-red-400"
                }`}
              >
                {improvement.positive ? "Increase" : "Decrease"}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              From first to latest quiz
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default StatsCards;
