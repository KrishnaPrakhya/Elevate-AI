"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, X, BookOpen, Brain } from "lucide-react";
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
        className="p-8 bg-white rounded-2xl shadow-xl border border-gray-100"
      >
        <motion.h2
          className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          Select Top Skills Quiz Topics
        </motion.h2>

        <div className="space-y-6">
          {Topics?.map((topic, topicIndex) => (
            <motion.div
              key={topic.name}
              className="mb-6 bg-gray-50 p-5 rounded-xl border border-gray-100"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: topicIndex * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-200">
                {/* {topicIcons[topic as keyof typeof topicIcons]} */}
                <h3 className="text-xl font-semibold text-gray-800">
                  {topic.name}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topic.subtopics?.map((subtopic, subIndex) => (
                  <motion.label
                    key={subtopic}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: topicIndex * 0.1 + subIndex * 0.05 }}
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
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-300"
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
                    <span className="text-gray-700">{subtopic}</span>
                  </motion.label>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex gap-4 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Button
            type="button"
            onClick={handleLearnTopics}
            disabled={isGeneratingContent}
            className={`flex-1 py-3 rounded-xl text-white font-medium transition-all shadow-md ${
              isGeneratingContent
                ? "bg-green-400 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            }`}
          >
            {isGeneratingContent ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5" />
                Learn Topics
              </div>
            )}
          </Button>

          <Button
            type="submit"
            className="flex-1 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all shadow-md"
          >
            <div className="flex items-center justify-center gap-2">
              <Brain className="w-5 h-5" />
              Start Quiz
            </div>
          </Button>
        </motion.div>

        <AnimatePresence>
          {content && (
            <motion.div
              className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  Learning Content
                </h3>
                <Button
                  onClick={() => setContent(null)}
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="whitespace-pre-wrap text-gray-700 overflow-auto max-h-[400px] pr-2 custom-scrollbar">
                {formatContent(content)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
}
