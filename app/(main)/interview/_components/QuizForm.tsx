"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, X, BookOpen, Brain, Loader2 } from "lucide-react";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/use-window-size";
import { generateTopicContent, generateTopicQuiz } from "@/actions/topicQuiz";
import { QuizResponse } from "../types";

interface Topics {
  name: string;
  subtopics: string[];
}

interface QuizFormProps {
  setQuizData: (data: QuizResponse) => void;
  setQuizStarted: (started: boolean) => void;
  Topics: Topics[] | undefined;
}

// const subtopics = {
//   Java: [
//     "Object-Oriented Programming",
//     "Collections Framework",
//     "Exception Handling",
//     "Multithreading",
//     "Java I/O",
//   ],
//   Python: [
//     "Data Structures",
//     "List Comprehensions",
//     "Decorators",
//     "File Handling",
//     "Modules and Packages",
//   ],
//   JavaScript: [
//     "ES6 Features",
//     "Promises & Async/Await",
//     "DOM Manipulation",
//     "Closures",
//     "Prototypal Inheritance",
//   ],
//   "Data Science": [
//     "Machine Learning Basics",
//     "Data Visualization",
//     "Statistical Analysis",
//     "Natural Language Processing",
//     "Neural Networks",
//   ],
// };

export default function QuizForm({
  setQuizData,
  setQuizStarted,
  Topics,
}: QuizFormProps) {
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();
  console.log(Topics);
  const handleCheckboxChange = (subtopic: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopic)
        ? prev.filter((item) => item !== subtopic)
        : [...prev, subtopic]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedSubtopics.length === 0) {
      alert("Please select at least one subtopic.");
      return;
    }

    // Show confetti briefly when starting quiz
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);

    const quizData = await generateTopicQuiz(selectedSubtopics);
    setQuizData(quizData);
    setQuizStarted(true);
  };

  const handleLearnTopics = async () => {
    if (selectedSubtopics.length === 0) {
      alert("Please select at least one subtopic to learn.");
      return;
    }

    try {
      setIsGeneratingContent(true);
      const generatedContent = await generateTopicContent(selectedSubtopics);
      setContent(generatedContent);
    } catch (error) {
      console.error(error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Function to format plain text with line breaks
  const formatContent = (text: string) => {
    return text.split("\n").map((paragraph, index) => (
      <motion.p
        key={index}
        className="mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        {paragraph.trim() === "" ? <br /> : paragraph}
      </motion.p>
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl"
    >
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="p-6 bg-background rounded-2xl shadow-xl border border-primary/20"
      >
        <motion.h2
          className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          Select Topics for Quiz
        </motion.h2>

        <div className="space-y-4">
          {Topics?.map((topic, topicIndex) => (
            <motion.div
              key={topic.name}
              className="p-4 bg-muted/50 rounded-xl border border-primary/10"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: topicIndex * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-3 border-b border-primary/10 pb-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">{topic.name}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {topic.subtopics?.map((subtopic, subIndex) => (
                  <motion.label
                    key={subtopic}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: topicIndex * 0.1 + subIndex * 0.03 }}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedSubtopics.includes(subtopic)}
                        onChange={() => handleCheckboxChange(subtopic)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          selectedSubtopics.includes(subtopic)
                            ? "bg-primary border-primary"
                            : "border-border"
                        }`}
                      >
                        {selectedSubtopics.includes(subtopic) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                            }}
                          >
                            <CheckCircle className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm">{subtopic}</span>
                  </motion.label>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex gap-3 mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Button
            type="button"
            onClick={handleLearnTopics}
            disabled={isGeneratingContent}
            className={`flex-1 py-2.5 rounded-xl text-white font-medium transition-all shadow-md ${
              isGeneratingContent
                ? "bg-muted cursor-not-allowed text-muted-foreground"
                : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
            }`}
          >
            {isGeneratingContent ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-4 h-4" />
                Learn Topics
              </div>
            )}
          </Button>

          <Button
            type="submit"
            className="flex-1 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90 transition-all shadow-md"
          >
            <div className="flex items-center justify-center gap-2">
              <Brain className="w-4 h-4" />
              Start Quiz
            </div>
          </Button>
        </motion.div>

        <AnimatePresence>
          {content && (
            <motion.div
              className="mt-6 p-4 bg-muted/50 rounded-xl border border-primary/20"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Learning Content
                </h3>
                <Button
                  onClick={() => setContent(null)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="whitespace-pre-wrap text-sm overflow-auto max-h-[400px] pr-2 custom-scrollbar">
                {formatContent(content)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
}
