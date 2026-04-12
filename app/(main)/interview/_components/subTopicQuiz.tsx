"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Sparkles, ChevronRight } from "lucide-react";
import { QuizResponse } from "../types";
import QuizForm from "./QuizForm";
import QuizGame from "./QuizGame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Topics {
  name: string;
  subtopics: string[];
}

interface Props {
  Topics: Topics[] | undefined;
}

export default function SubTopicQuiz(props: Props) {
  const { Topics } = props;
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizData, setQuizData] = useState<QuizResponse>([]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/10 to-cyan-500/10 rounded-xl border border-primary/20">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
              Sub-Topic Quiz
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Master specific skills with focused quizzes
            </p>
          </div>
        </div>

        {/* Topic Pills */}
        {Topics && Topics.length > 0 && (
          <motion.div
            className="flex flex-wrap gap-2 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {Topics.slice(0, 8).map((topic) => (
              <Badge
                key={topic.name}
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20"
              >
                {topic.name}
                <ChevronRight className="w-3 h-3 ml-1" />
                <span className="text-xs text-muted-foreground ml-1">
                  {topic.subtopics?.length || 0} subtopics
                </span>
              </Badge>
            ))}
            {Topics.length > 8 && (
              <Badge variant="outline" className="bg-muted">
                +{Topics.length - 8} more
              </Badge>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Info Cards */}
      {!quizStarted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">Learn First</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Generate AI-powered learning content for your selected topics
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-base">Test Knowledge</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Take interactive quizzes with instant feedback and explanations
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <CardTitle className="text-base">Track Progress</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor your improvement with detailed score analytics
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quiz Form or Game */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        {!quizStarted ? (
          <QuizForm
            Topics={Topics}
            setQuizData={setQuizData}
            setQuizStarted={setQuizStarted}
          />
        ) : (
          <QuizGame quizData={quizData} setQuizStarted={setQuizStarted} />
        )}
      </motion.div>

      {/* Footer Tip */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="inline-block border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <CardContent className="py-3 px-6">
            <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Tip: Start with learning content if you&apos;re new to a topic
              <Sparkles className="w-4 h-4 text-amber-500" />
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
