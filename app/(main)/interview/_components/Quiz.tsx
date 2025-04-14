"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { generateQuiz, saveQuizResult } from "@/actions/interview";
import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";
import QuizResult from "./quiz-result";
import {
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Timer,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export default function Quiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<any>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const {
    loading: generatingQuiz,
    fn: generateQuizFn,
    data: quizData,
  } = useFetch(generateQuiz);

  const {
    loading: savingResult,
    fn: saveQuizResultFn,
    data: resultData,
    setData: setResultData,
  } = useFetch(saveQuizResult);

  useEffect(() => {
    if (quizData) {
      setAnswers(new Array(quizData.length).fill(null));
      // Set a timer for each question (2 minutes per question)
      setTimeLeft(120);
    }
  }, [quizData]);

  // Timer effect
  useEffect(() => {
    if (!quizData || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [quizData, timeLeft]);

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    console.log(answer);
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
      setTimeLeft(120); // Reset timer for next question
    } else {
      finishQuiz();
    }
  };

  const calculateScore = () => {
    let correct = 0;
    console.log(answers);
    console.log(quizData);
    answers.forEach((answer: string, index: number) => {
      if (answer === quizData[index].correctAnswer) {
        correct++;
      }
      console.log(correct);
    });
    return (correct / quizData.length) * 100;
  };

  const finishQuiz = async () => {
    const score = calculateScore();
    try {
      await saveQuizResultFn(quizData, answers, score);
      toast.success("Quiz completed successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save quiz results");
    }
  };

  const startNewQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowExplanation(false);
    generateQuizFn();
    setResultData(null);
  };

  // Format time left
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (generatingQuiz) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium mb-2">
              Generating your personalized quiz...
            </h3>
            <p className="text-sm text-muted-foreground">
              We're creating questions tailored to your industry
            </p>
          </div>
          <BarLoader color="hsl(var(--primary))" width={200} />
        </div>
      </Card>
    );
  }

  // Show results if quiz is completed
  if (resultData) {
    return <QuizResult result={resultData} onStartNew={startNewQuiz} />;
  }

  if (!quizData) {
    return (
      <Card className="overflow-hidden border-t-4 border-t-primary transition-all hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Ready to test your knowledge?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <p className="text-muted-foreground mb-6">
            This quiz contains 10 questions specific to your industry and
            skills. Take your time and choose the best answer for each question.
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="mt-0.5">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Personalized Questions</p>
                <p className="text-sm text-muted-foreground">
                  Questions are tailored to your industry and experience level
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="mt-0.5">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Detailed Explanations</p>
                <p className="text-sm text-muted-foreground">
                  Learn from comprehensive explanations for each question
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t px-6 py-4">
          <Button
            onClick={generateQuizFn}
            className="w-full group relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Start Quiz
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300"></span>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const question = quizData[currentQuestion];
  const progress = ((currentQuestion + 1) / quizData.length) * 100;

  return (
    <Card className="overflow-hidden border-t-4 border-t-primary transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>
                Question {currentQuestion + 1} of {quizData.length}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span
                className={`${
                  timeLeft < 30
                    ? "text-red-500 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <p className="text-lg font-medium">{question.question}</p>

            <RadioGroup
              onValueChange={handleAnswer}
              value={answers[currentQuestion]}
              className="space-y-3"
            >
              {question.options.map((option: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    answers[currentQuestion] === option
                      ? "bg-primary/10 border-primary/30"
                      : "hover:bg-muted/50 border-border"
                  }`}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label
                    htmlFor={`option-${index}`}
                    className={`flex-grow cursor-pointer ${
                      answers[currentQuestion] === option ? "font-medium" : ""
                    }`}
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  <p className="font-medium">Explanation:</p>
                </div>
                <p className="text-muted-foreground">{question.explanation}</p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>

      <CardFooter className="flex justify-between bg-muted/20 border-t px-6 py-4">
        {!showExplanation && (
          <Button
            onClick={() => setShowExplanation(true)}
            variant="outline"
            disabled={!answers[currentQuestion]}
            className="gap-2"
          >
            <Lightbulb className="h-4 w-4" />
            Show Explanation
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!answers[currentQuestion] || savingResult}
          className={`${showExplanation ? "w-full" : "ml-auto"} gap-2`}
        >
          {savingResult ? (
            <BarLoader color="#ffffff" width={100} height={4} />
          ) : (
            <>
              {currentQuestion < quizData.length - 1
                ? "Next Question"
                : "Finish Quiz"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
