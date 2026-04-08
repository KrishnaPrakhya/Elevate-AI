"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  MessageSquare,
  Brain,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Volume2,
  Type,
  SkipForward,
  ThumbsUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";
import { getUserProfile } from "@/actions/user";
import { getRoleOptionsByIndustry } from "@/actions/profile-options";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedDuration: number;
  followUps?: string[];
}

interface InterviewResponse {
  questionId: string;
  answer: string;
  duration: number;
  transcript?: string;
}

interface InterviewFeedback {
  overall: number;
  categories: {
    technical: number;
    communication: number;
    problemSolving: number;
    confidence: number;
  };
  strengths: string[];
  improvements: string[];
  summary: string;
}

type InterviewMode = "voice" | "text";
type InterviewState = "idle" | "starting" | "active" | "feedback";

const DEFAULT_ROLE_OPTIONS = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "ML Engineer",
  "DevOps Engineer",
  "Product Manager",
];

const EXPERIENCE_LEVEL_OPTIONS = [
  "Intern",
  "Junior",
  "Mid-Level",
  "Senior",
  "Staff",
  "Principal",
];

function toExperienceLevel(experience?: number | null): string {
  const years = typeof experience === "number" ? experience : null;
  if (years === null) return "Mid-Level";
  if (years <= 0) return "Intern";
  if (years < 2) return "Junior";
  if (years < 5) return "Mid-Level";
  if (years < 8) return "Senior";
  if (years < 12) return "Staff";
  return "Principal";
}

// SpeechRecognition interface for web speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export type LocalInterviewSimulatorProps = {
  initialMode?: InterviewMode;
  showModeToggle?: boolean;
};

export default function LocalInterviewSimulator({
  initialMode = "voice",
  showModeToggle = true,
}: LocalInterviewSimulatorProps) {
  const [mode, setMode] = useState<InterviewMode>(initialMode);
  const [state, setState] = useState<InterviewState>("idle");
  const [currentQuestion, setCurrentQuestion] =
    useState<InterviewQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [selectedLevel, setSelectedLevel] = useState("Mid-Level");
  const [roleOptions, setRoleOptions] =
    useState<string[]>(DEFAULT_ROLE_OPTIONS);
  const [interviewSource, setInterviewSource] = useState("ollama-cloud");
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [lastInterviewerReply, setLastInterviewerReply] = useState("");
  const [autoVoiceTurn, setAutoVoiceTurn] = useState(initialMode === "voice");
  const [autoSubmitVoice, setAutoSubmitVoice] = useState(
    initialMode === "voice",
  );
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const latestAnswerRef = useRef("");

  const speakText = useCallback(
    (text: string, cancelCurrent = false) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !text.trim()) {
          resolve();
          return;
        }

        const synth = window.speechSynthesis;
        if (!synth) {
          resolve();
          return;
        }

        if (cancelCurrent) {
          synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text.trim());
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };
        synth.speak(utterance);
      }),
    [],
  );

  const runInterviewerVoiceTurn = useCallback(
    async (reply?: string, questionText?: string) => {
      if (mode !== "voice" || !autoVoiceTurn) {
        return;
      }

      const safeReply = (reply || "").trim();
      const safeQuestion = (questionText || "").trim();

      if (safeReply) {
        await speakText(safeReply, true);
      }

      if (safeQuestion) {
        await speakText(`Next question. ${safeQuestion}`, !safeReply);
      }
    },
    [mode, autoVoiceTurn, speakText],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromProfile() {
      try {
        const profile = await getUserProfile();
        if (!profile || cancelled) return;

        const profileRole = profile.targetRole?.trim();
        if (profileRole) {
          setSelectedRole(profileRole);
        }

        setSelectedLevel(toExperienceLevel(profile.experience));

        const industryId = profile.industry?.split("-")[0] || "";
        const dynamicRoles = await getRoleOptionsByIndustry(industryId).catch(
          () => [],
        );
        if (cancelled) return;

        const mergedRoles = Array.from(
          new Set(
            [
              ...(profileRole ? [profileRole] : []),
              ...dynamicRoles.map((role) => role.title),
              ...DEFAULT_ROLE_OPTIONS,
            ].filter(Boolean),
          ),
        );
        if (mergedRoles.length > 0) {
          setRoleOptions(mergedRoles);
        }
      } catch {
        if (!cancelled) {
          setRoleOptions(DEFAULT_ROLE_OPTIONS);
        }
      }
    }

    void hydrateFromProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        const normalized = transcript.trim();
        latestAnswerRef.current = normalized;
        setUserAnswer(normalized);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startInterview = async () => {
    setState("starting");
    setQuestionIndex(0);
    setResponses([]);
    setFeedback(null);
    setUserAnswer("");
    latestAnswerRef.current = "";
    setSessionStartedAt(Date.now());
    try {
      const response = await axios.post("/api/interview-simulator/start", {
        role: selectedRole,
        level: selectedLevel,
        mode,
        numQuestions: totalQuestions,
      });

      if (response.data.questions && response.data.questions.length > 0) {
        const openingPrompt =
          `Welcome to your mock interview for ${selectedRole}. ` +
          `Let us begin with question one.`;
        setCurrentQuestion(response.data.questions[0]);
        setTimeRemaining(response.data.questions[0].expectedDuration);
        setInterviewSource(response.data.source || "ollama-cloud");
        setLastInterviewerReply(openingPrompt);
        setState("active");
        if ((response.data.source || "").startsWith("fallback")) {
          toast.info(
            "Using backup question flow. Add/update OLLAMA_API_KEY for Cloud mode.",
          );
        }
        toast.success("Interview started! Good luck!");
        void runInterviewerVoiceTurn(
          openingPrompt,
          response.data.questions[0].question,
        );
      } else {
        throw new Error("No questions received");
      }
    } catch (error) {
      console.error("Error starting interview:", error);
      toast.error("Failed to start interview");
      setState("idle");
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    setUserAnswer("");
    latestAnswerRef.current = "";
    recognitionRef.current.start();
    setIsRecording(true);
    toast.info("Listening... Speak your answer");
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      toast.success("Recording stopped");

      if (mode === "voice" && autoSubmitVoice) {
        setTimeout(() => {
          const answerToSend = latestAnswerRef.current.trim();
          if (!isSubmittingAnswer && answerToSend) {
            void submitAnswer(answerToSend);
          }
        }, 350);
      }
    }
  };

  const submitAnswer = async (providedAnswer?: string) => {
    if (isSubmittingAnswer) {
      return;
    }

    const answerText = (providedAnswer ?? userAnswer).trim();
    if (!currentQuestion || !answerText) {
      toast.error("Please provide an answer");
      return;
    }

    try {
      setIsSubmittingAnswer(true);
      const normalizedAnswer = answerText;
      const response: InterviewResponse = {
        questionId: currentQuestion.id,
        answer: normalizedAnswer,
        duration: Math.max(1, currentQuestion.expectedDuration - timeRemaining),
      };
      const updatedResponses = [...responses, response];
      setResponses(updatedResponses);

      if (questionIndex < totalQuestions - 1) {
        await nextQuestion({
          nextResponses: updatedResponses,
          answerForAdaptation: normalizedAnswer,
        });
      } else {
        await finishInterview(updatedResponses);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const nextQuestion = useCallback(
    async ({
      nextResponses,
      answerForAdaptation,
    }: {
      nextResponses?: InterviewResponse[];
      answerForAdaptation?: string;
    } = {}) => {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);

      try {
        const activeResponses = nextResponses ?? responses;
        const response = await axios.post("/api/interview-simulator/next", {
          questionIndex: nextIndex,
          previousAnswer: answerForAdaptation ?? userAnswer,
          responses: activeResponses,
          mode,
          role: selectedRole,
          level: selectedLevel,
        });

        if (response.data.question) {
          const interviewerReply =
            typeof response.data.interviewerReply === "string"
              ? response.data.interviewerReply
              : "Good answer. Let us continue.";

          setCurrentQuestion(response.data.question);
          setTimeRemaining(response.data.question.expectedDuration);
          setInterviewSource(response.data.source || interviewSource);
          setLastInterviewerReply(interviewerReply);
          setUserAnswer("");
          latestAnswerRef.current = "";
          if ((response.data.source || "").startsWith("fallback")) {
            toast.info(
              "Using fallback question due to temporary model response issue.",
            );
          }
          toast.success(`Question ${nextIndex + 1} of ${totalQuestions}`);
          void runInterviewerVoiceTurn(
            interviewerReply,
            response.data.question.question,
          );
        }
      } catch (error) {
        console.error("Error getting next question:", error);
        toast.error("Could not fetch the next question. Please retry.");
      }
    },
    [
      questionIndex,
      responses,
      userAnswer,
      mode,
      totalQuestions,
      selectedRole,
      selectedLevel,
      interviewSource,
      runInterviewerVoiceTurn,
    ],
  );

  const finishInterview = useCallback(
    async (finalResponses?: InterviewResponse[]) => {
      setState("starting");
      const activeResponses = finalResponses ?? responses;
      const computedDurationSeconds = sessionStartedAt
        ? Math.max(60, Math.round((Date.now() - sessionStartedAt) / 1000))
        : Math.max(
            60,
            activeResponses.reduce(
              (sum, item) => sum + Math.max(1, item.duration || 0),
              0,
            ),
          );
      try {
        const response = await axios.post("/api/interview-simulator/finish", {
          responses: activeResponses,
          mode,
          duration: Math.max(1, Math.round(computedDurationSeconds / 60)),
          durationSeconds: computedDurationSeconds,
        });

        if (response.data.feedback) {
          setFeedback(response.data.feedback);
          setInterviewSource(response.data.source || interviewSource);
          setState("feedback");
          toast.success("Interview completed! Check your feedback below.");
        }
      } catch (error) {
        console.error("Error finishing interview:", error);
        toast.error("Failed to get feedback");
        setState("idle");
      }
    },
    [responses, mode, sessionStartedAt, interviewSource],
  );

  const handleSkipQuestion = useCallback(() => {
    toast.info("Question skipped");
    if (questionIndex < totalQuestions - 1) {
      nextQuestion({
        nextResponses: responses,
        answerForAdaptation: "[Skipped by candidate]",
      });
    } else {
      finishInterview(responses);
    }
  }, [questionIndex, totalQuestions, nextQuestion, finishInterview, responses]);

  useEffect(() => {
    if (state === "active" && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSkipQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state, timeRemaining, handleSkipQuestion]);

  const endInterview = () => {
    setState("idle");
    window.speechSynthesis.cancel();
    setCurrentQuestion(null);
    setQuestionIndex(0);
    setResponses([]);
    setFeedback(null);
    setUserAnswer("");
    latestAnswerRef.current = "";
    setSessionStartedAt(null);
    setInterviewSource("ollama-cloud");
    setLastInterviewerReply("");
  };

  const speakQuestion = () => {
    if (!currentQuestion) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeColor = () => {
    if (timeRemaining > 60) return "bg-emerald-500";
    if (timeRemaining > 30) return "bg-amber-500";
    return "bg-red-500";
  };

  if (state === "idle") {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <Brain className="w-4 h-4" />
            <span className="text-sm font-medium">
              Ollama Cloud Interview Agent
            </span>
          </div>
          <h1 className="text-4xl font-bold">Interview Simulator</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Practice with Ollama Cloud-powered interviews. Voice mode uses your
            browser microphone for real-time transcription while the interview
            intelligence and feedback run on your cloud model.
          </p>
        </motion.div>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle>Interview Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Experience Level</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background"
                >
                  {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showModeToggle && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Interview Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setMode("voice")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      mode === "voice"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {mode === "voice" ? (
                        <Mic className="w-8 h-8 text-primary" />
                      ) : (
                        <MicOff className="w-8 h-8 text-muted-foreground" />
                      )}
                      <span className="font-medium">Voice Mode</span>
                      <span className="text-xs text-muted-foreground">
                        Speak your answers with live transcription
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setMode("text")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      mode === "text"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {mode === "text" ? (
                        <Type className="w-8 h-8 text-primary" />
                      ) : (
                        <MessageSquare className="w-8 h-8 text-muted-foreground" />
                      )}
                      <span className="font-medium">Text Mode</span>
                      <span className="text-xs text-muted-foreground">
                        Type your answers at your own pace
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Questions</label>
              <div className="flex gap-2">
                {[3, 5, 8, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setTotalQuestions(num)}
                    className={`flex-1 py-2 rounded-md border transition-all ${
                      totalQuestions === num
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {mode === "voice" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setAutoVoiceTurn((prev) => !prev)}
                  className={`p-3 rounded-lg border text-sm text-left transition-all ${
                    autoVoiceTurn
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border hover:border-emerald-400/60"
                  }`}
                >
                  <p className="font-medium">AI Voice Reply</p>
                  <p className="text-xs text-muted-foreground">
                    {autoVoiceTurn
                      ? "On: AI speaks acknowledgment and next question"
                      : "Off: use manual question playback only"}
                  </p>
                </button>
                <button
                  onClick={() => setAutoSubmitVoice((prev) => !prev)}
                  className={`p-3 rounded-lg border text-sm text-left transition-all ${
                    autoSubmitVoice
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border hover:border-emerald-400/60"
                  }`}
                >
                  <p className="font-medium">Hands-Free Submit</p>
                  <p className="text-xs text-muted-foreground">
                    {autoSubmitVoice
                      ? "On: answer auto-submits after stopping mic"
                      : "Off: submit manually"}
                  </p>
                </button>
              </div>
            )}

            <Button
              size="lg"
              className="w-full gap-2 text-lg"
              onClick={startInterview}
            >
              <Phone className="w-5 h-5" />
              Start Interview
            </Button>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">What to expect:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                    <li>Ollama Cloud questions tailored to role and level</li>
                    <li>Adaptive difficulty using ongoing answer context</li>
                    <li>Live transcription in voice mode</li>
                    <li>AI interviewer speaks back between questions</li>
                    <li>Structured feedback with improvement tips</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "starting") {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 py-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Brain className="w-10 h-10 text-primary animate-pulse" />
        </motion.div>
        <h2 className="text-2xl font-bold">Preparing your interview...</h2>
        <p className="text-muted-foreground">
          AI is generating personalized questions for {selectedRole} (
          {selectedLevel})
        </p>
        <div className="w-full max-w-md mx-auto">
          <Progress value={undefined} className="h-2" />
        </div>
      </div>
    );
  }

  if (state === "feedback" && feedback) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Interview Complete</span>
          </div>
          <h1 className="text-4xl font-bold">Your Performance</h1>
        </motion.div>

        <Card className="border-primary/20 shadow-lg overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="hsl(var(--muted))"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke={`hsl(${feedback.overall >= 70 ? 142 : feedback.overall >= 50 ? 45 : 0}, 70%, 50%)`}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(feedback.overall / 100) * 440} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">
                    {feedback.overall}%
                  </span>
                  <span className="text-sm text-muted-foreground">Overall</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Technical</p>
                  <p className="text-2xl font-bold">
                    {feedback.categories.technical}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Communication</p>
                  <p className="text-2xl font-bold">
                    {feedback.categories.communication}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Problem Solving
                  </p>
                  <p className="text-2xl font-bold">
                    {feedback.categories.problemSolving}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold">
                    {feedback.categories.confidence}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {feedback.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2"
                    >
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {feedback.improvements.map((imp, i) => (
                    <li
                      key={i}
                      className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2"
                    >
                      <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h3 className="font-semibold mb-2">AI Summary</h3>
              <AIResponseFormatter
                content={formatAIResponse(feedback.summary)}
                variant="chat"
              />
            </div>

            <div className="flex gap-4 mt-8">
              <Button
                variant="outline"
                onClick={endInterview}
                className="flex-1"
              >
                Back to Setup
              </Button>
              <Button onClick={startInterview} className="flex-1 gap-2">
                <Sparkles className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1">
            Question {questionIndex + 1} of {totalQuestions}
          </Badge>
          <Badge
            variant="outline"
            className={mode === "voice" ? "bg-primary/10" : ""}
          >
            {mode === "voice" ? (
              <Mic className="w-3 h-3 mr-1" />
            ) : (
              <Type className="w-3 h-3 mr-1" />
            )}
            {mode === "voice" ? "Voice" : "Text"} Mode
          </Badge>
          <Badge
            variant="outline"
            className={
              interviewSource.startsWith("fallback")
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }
          >
            {interviewSource.startsWith("fallback")
              ? "Fallback Flow"
              : "Ollama Cloud"}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={endInterview}
          className="text-red-500 hover:text-red-600"
        >
          <PhoneOff className="w-4 h-4 mr-2" />
          End Interview
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${getTimeColor()} text-white`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Progress
              value={
                (timeRemaining / (currentQuestion?.expectedDuration || 1)) * 100
              }
              className="flex-1 h-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentQuestion?.category}</Badge>
                <Badge
                  variant={
                    currentQuestion?.difficulty === "hard"
                      ? "destructive"
                      : currentQuestion?.difficulty === "medium"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {currentQuestion?.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-xl leading-relaxed">
                {currentQuestion?.question}
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={speakQuestion}
              disabled={isSpeaking}
              className="ml-4 flex-shrink-0"
            >
              {isSpeaking ? (
                <Volume2 className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "voice" && (
            <div className="flex items-center justify-center gap-4 py-4">
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "default"}
                onClick={isRecording ? stopRecording : startRecording}
                className="w-32 h-32 rounded-full"
              >
                {isRecording ? (
                  <MicOff className="w-12 h-12" />
                ) : (
                  <Mic className="w-12 h-12" />
                )}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Answer</label>
            {mode === "voice" ? (
              <div className="min-h-[150px] p-4 rounded-lg border border-primary/20 bg-muted/50">
                {userAnswer || (
                  <span className="text-muted-foreground italic">
                    {isRecording
                      ? "Listening..."
                      : "Click the microphone to start speaking..."}
                  </span>
                )}
              </div>
            ) : (
              <textarea
                value={userAnswer}
                onChange={(e) => {
                  latestAnswerRef.current = e.target.value;
                  setUserAnswer(e.target.value);
                }}
                placeholder="Type your answer here..."
                className="w-full min-h-[200px] p-4 rounded-lg border border-primary/20 bg-background resize-none"
              />
            )}
          </div>

          {lastInterviewerReply && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                AI Interviewer
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {lastInterviewerReply}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={handleSkipQuestion}>
              <SkipForward className="w-4 h-4 mr-2" />
              Skip
            </Button>
            <Button
              onClick={() => {
                void submitAnswer();
              }}
              disabled={!userAnswer.trim() || isSubmittingAnswer}
            >
              {questionIndex < totalQuestions - 1 ? (
                <>
                  Next Question
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Finish Interview
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Interview Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Take a moment to gather your thoughts before answering</li>
                <li>Use specific examples from your experience</li>
                <li>
                  Structure your answers clearly (STAR method recommended)
                </li>
                <li>Ask clarifying questions if needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
