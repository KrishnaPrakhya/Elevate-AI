"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Clock,
  Award,
  Home,
  Share2,
} from "lucide-react";
import Confetti from "react-confetti";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react"; // Import BookOpen
import { useWindowSize } from "@/hooks/use-window-size";
import { QuizResponse } from "../types";

interface QuizGameProps {
  quizData: QuizResponse;
  setQuizStarted: (started: boolean) => void;
}

export default function QuizGame({ quizData, setQuizStarted }: QuizGameProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizEnded, setQuizEnded] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [direction, setDirection] = useState(0); // For slide animation direction
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const handleNextQuestion = () => {
    setDirection(1);
    if (currentQuestionIndex + 1 < quizData.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setTimeLeft(30);
      setShowExplanation(false);
      setFeedbackMessage("");
    } else {
      setQuizEnded(true);
      // Show confetti if score is good (more than 70%)
      const scorePercentage = (score.correct / quizData.length) * 100;
      if (scorePercentage >= 70) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    }
  };

  const handleRestart = () => {
    setQuizStarted(false);
    setCurrentQuestionIndex(0);
    setScore({ correct: 0, wrong: 0 });
    setQuizEnded(false);
    setTimeLeft(30);
    setSelectedOption(null);
    setShowExplanation(false);
    setFeedbackMessage("");
  };
  const currentQuestion = quizData[currentQuestionIndex];

  // Play sound effect based on answer correctness

  // Calculate progress percentage
  const progressPercentage =
    ((currentQuestionIndex + 1) / quizData.length) * 100;

  // Calculate time percentage for the timer
  const timePercentage = (timeLeft / 30) * 100;

  const handleAnswer = useCallback(() => {
    const isCorrect = selectedOption === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
      setFeedbackMessage("Great job! That's correct!");
    } else {
      setScore((prev) => ({ ...prev, wrong: prev.wrong + 1 }));
      setFeedbackMessage("Not quite right. Let's learn why.");
    }
    setShowExplanation(true);
  }, [selectedOption, currentQuestion]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!quizEnded && !showExplanation) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev > 0) {
            return prev - 1;
          } else {
            clearInterval(timer);
            handleAnswer();
            return 0;
          }
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timeLeft, quizEnded, showExplanation, handleAnswer]);

  if (!quizData || quizData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl text-center"
      >
        <h2 className="text-2xl font-bold mb-4 text-red-600">
          Error Loading Quiz
        </h2>
        <p className="text-lg text-gray-700">
          No questions available. Please try again.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setQuizStarted(false)}
          className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-md"
        >
          Go Back
        </motion.button>
      </motion.div>
    );
  }

  // Calculate score percentage
  const scorePercentage =
    quizData.length > 0
      ? Math.round((score.correct / quizData.length) * 100)
      : 0;

  // Get feedback based on score
  const getFeedback = () => {
    if (scorePercentage >= 90)
      return "Outstanding! You're a master of this subject!";
    if (scorePercentage >= 80)
      return "Excellent work! You have a strong understanding!";
    if (scorePercentage >= 70) return "Great job! You know your stuff!";
    if (scorePercentage >= 60)
      return "Good effort! Keep practicing to improve!";
    if (scorePercentage >= 50)
      return "Not bad! More study will help you improve.";
    return "Keep learning! You'll get better with practice.";
  };

  if (quizEnded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl text-center"
      >
        {showConfetti && (
          <Confetti
            width={width}
            height={height}
            recycle={false}
            numberOfPieces={300}
          />
        )}

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6"
        >
          {scorePercentage >= 70 ? (
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-12 h-12 text-white" />
            </div>
          ) : scorePercentage >= 50 ? (
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          ) : (
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
          )}
        </motion.div>

        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Quiz Completed!
        </h2>

        <motion.p
          className="text-lg text-gray-700 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {getFeedback()}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200"
        >
          <div className="flex justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-gray-200"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <motion.circle
                  className="text-purple-600"
                  strokeWidth="10"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  initial={{
                    strokeDasharray: "251.2",
                    strokeDashoffset: "251.2",
                  }}
                  animate={{
                    strokeDashoffset: 251.2 - (251.2 * scorePercentage) / 100,
                  }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
                <text
                  x="50"
                  y="50"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-bold text-2xl fill-purple-600"
                >
                  {scorePercentage}%
                </text>
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-green-50 p-4 rounded-xl border border-green-100"
            >
              <p className="text-lg font-medium text-green-800">Correct</p>
              <p className="text-3xl font-bold text-green-600">
                {score.correct}
              </p>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-red-50 p-4 rounded-xl border border-red-100"
            >
              <p className="text-lg font-medium text-red-800">Wrong</p>
              <p className="text-3xl font-bold text-red-600">{score.wrong}</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={handleRestart}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-md"
          >
            <RotateCcw className="w-5 h-5" />
            Restart Quiz
          </Button>

          <Button
            onClick={() => setQuizStarted(false)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 px-6 rounded-xl hover:from-gray-600 hover:to-gray-700 transition shadow-md"
          >
            <Home className="w-5 h-5" />
            Home
          </Button>

          <Button
            onClick={() => {
              try {
                navigator.share({
                  title: "My Quiz Results",
                  text: `I scored ${scorePercentage}% on the quiz!`,
                  url: window.location.href,
                });
              } catch (err) {
                console.log(err);
                alert("Sharing not supported on this browser");
              }
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition shadow-md"
          >
            <Share2 className="w-5 h-5" />
            Share Results
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl"
    >
      <div className="p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="mb-6">
          {/* Progress bar */}
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-600">
              Question {currentQuestionIndex + 1} of {quizData.length}
            </p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-medium text-gray-600">{timeLeft}s</p>
            </div>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
              initial={{
                width: `${(currentQuestionIndex / quizData.length) * 100}%`,
              }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Timer bar */}
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-2">
            <motion.div
              className={`h-full ${
                timeLeft < 10
                  ? "bg-gradient-to-r from-red-400 to-red-600"
                  : "bg-gradient-to-r from-yellow-400 to-red-500"
              }`}
              initial={{ width: "100%" }}
              animate={{ width: `${timePercentage}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-semibold mb-6 text-gray-800">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={index}
                  onClick={() => !showExplanation && handleOptionSelect(option)}
                  disabled={!!showExplanation}
                  className={`w-full p-4 text-left rounded-xl border transition-all ${
                    showExplanation && option === currentQuestion.correctAnswer
                      ? "bg-green-50 border-green-500"
                      : showExplanation &&
                        selectedOption === option &&
                        option !== currentQuestion.correctAnswer
                      ? "bg-red-50 border-red-500"
                      : selectedOption === option
                      ? "bg-purple-50 border-purple-500"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                  whileHover={!showExplanation ? { scale: 1.02 } : {}}
                  whileTap={!showExplanation ? { scale: 0.98 } : {}}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full mr-3 flex items-center justify-center ${
                        showExplanation &&
                        option === currentQuestion.correctAnswer
                          ? "bg-green-500"
                          : showExplanation &&
                            selectedOption === option &&
                            option !== currentQuestion.correctAnswer
                          ? "bg-red-500"
                          : selectedOption === option
                          ? "bg-purple-500"
                          : "bg-gray-200"
                      }`}
                    >
                      <span className="text-white text-xs font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                    </div>
                    <span
                      className={`${
                        showExplanation &&
                        option === currentQuestion.correctAnswer
                          ? "text-green-800"
                          : showExplanation &&
                            selectedOption === option &&
                            option !== currentQuestion.correctAnswer
                          ? "text-red-800"
                          : "text-gray-700"
                      }`}
                    >
                      {option}
                    </span>

                    {showExplanation &&
                      option === currentQuestion.correctAnswer && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                          className="ml-auto"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </motion.div>
                      )}

                    {showExplanation &&
                      selectedOption === option &&
                      option !== currentQuestion.correctAnswer && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                          }}
                          className="ml-auto"
                        >
                          <XCircle className="w-5 h-5 text-red-500" />
                        </motion.div>
                      )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {!showExplanation ? (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={handleAnswer}
            className={`mt-8 w-full py-3 rounded-xl text-white font-medium transition-all ${
              !selectedOption
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-md"
            }`}
            disabled={!selectedOption}
            whileHover={selectedOption ? { scale: 1.02 } : {}}
            whileTap={selectedOption ? { scale: 0.98 } : {}}
          >
            Submit Answer
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            <div
              className={`p-4 rounded-xl mb-4 ${
                selectedOption === currentQuestion.correctAnswer
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center mb-2">
                {selectedOption === currentQuestion.correctAnswer ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <p className="font-semibold text-green-800">
                      {feedbackMessage}
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600 mr-2" />
                    <p className="font-semibold text-red-800">
                      {feedbackMessage}
                    </p>
                  </>
                )}
              </div>
              <p className="text-gray-700">{currentQuestion.explanation}</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextQuestion}
              className="w-full py-3 rounded-xl text-white font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all shadow-md flex items-center justify-center gap-2"
            >
              Next Question
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}

        <motion.div
          className="mt-6 flex justify-between items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <p className="text-sm text-gray-600">Correct: {score.correct}</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <p className="text-sm text-gray-600">Wrong: {score.wrong}</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRestart}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Restart
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
