"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Sparkles } from "lucide-react";
import { QuizResponse } from "../types";
import QuizForm from "./QuizForm";
import QuizGame from "./QuizGame";

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Interactive Learning Quiz
          </h1>
          <p className="text-gray-600 mt-2 flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-500" />
            Test your knowledge or learn new topics
            <Brain className="w-4 h-4 text-blue-500" />
          </p>

          <motion.div
            className="flex justify-center mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex gap-2">
              {Topics?.map((topic, i) => (
                <motion.div
                  key={topic.name}
                  className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 shadow-sm border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  whileHover={{ scale: 1.05, backgroundColor: "#f3f4f6" }}
                >
                  {topic.name}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {!quizStarted ? (
          <QuizForm
            Topics={Topics}
            setQuizData={setQuizData}
            setQuizStarted={setQuizStarted}
          />
        ) : (
          <QuizGame quizData={quizData} setQuizStarted={setQuizStarted} />
        )}

        <motion.div
          className="mt-8 text-center text-gray-500 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            Enhance your learning with interactive quizzes
            <Sparkles className="w-3 h-3 text-blue-400" />
          </p>
        </motion.div>
      </div>
    </div>
  );
}
