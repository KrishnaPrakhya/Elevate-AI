"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  PhoneOff,
  Brain,
  Sparkles,
  CheckCircle,
  Clock,
  Activity,
  Signal,
} from "lucide-react";
import {
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
  LiveKitRoom,
} from "@livekit/components-react";
import "@livekit/components-styles";
import axios from "axios";
import { AIResponseFormatter, formatAIResponse } from "@/components/ai-response-formatter";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

type InterviewState = "setup" | "connecting" | "active" | "feedback";

// Component that uses LiveKit hooks - must be inside LiveKitRoom context
function InterviewRoomContent({
  isSpeaking,
  setIsSpeaking,
  isMuted,
  setIsMuted,
  questions,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  spokenAnswer,
  isListeningAnswer,
  onToggleListening,
  commitCurrentAnswer,
  onReadQuestion,
}: {
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  spokenAnswer: string;
  isListeningAnswer: boolean;
  onToggleListening: () => void;
  commitCurrentAnswer: () => void;
  onReadQuestion: () => void;
}) {
  const localParticipant = useLocalParticipant();
  const tracks = useTracks();

  // Track if AI (remote participant) is speaking
  useEffect(() => {
    const remoteTracks = tracks.filter(
      (track) => track.participant.identity !== localParticipant.identity
    );
    const isRemoteSpeaking = remoteTracks.some(
      (track) =>
        track.source === "microphone" &&
        track.participant.isSpeaking
    );
    setIsSpeaking(isRemoteSpeaking);
  }, [tracks, localParticipant.identity, setIsSpeaking]);

  // Handle mute/unmute
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  };

  return (
    <div className="flex flex-col">
      {/* AI Interviewer Status */}
      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isSpeaking ? "bg-primary/20 animate-pulse" : "bg-muted"
            }`}>
              <Brain className={`w-8 h-8 ${isSpeaking ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">AI Interviewer</h3>
              <p className="text-sm text-muted-foreground">
                {isSpeaking ? "Speaking..." : "Listening..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Signal className={`w-5 h-5 ${isSpeaking ? "text-emerald-500" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Question */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Brain className="w-6 h-6 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Current Question:</h3>
              <p className="text-lg">
                {questions[currentQuestionIndex]?.question || "Waiting for question..."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={onReadQuestion}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Read Question Aloud
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                If live AI audio is unavailable, this uses browser voice as fallback.
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4 p-3 rounded-lg border bg-muted/20">
            <label className="text-sm font-medium">Your Live Answer Transcript</label>
            <p className="text-sm text-muted-foreground min-h-10">
              {spokenAnswer || "Start speaking to capture your answer..."}
            </p>
            <div className="flex gap-2">
              <Button onClick={onToggleListening} variant={isListeningAnswer ? "destructive" : "secondary"} size="sm">
                {isListeningAnswer ? "Stop Listening" : "Start Speaking"}
              </Button>
              <Button onClick={commitCurrentAnswer} variant="outline" size="sm">
                Save This Answer
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t">
            <Button
              size="lg"
              variant={isMuted ? "destructive" : "outline"}
              onClick={handleToggleMute}
              className="w-14 h-14 rounded-full"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                commitCurrentAnswer();
                if (currentQuestionIndex < questions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                  toast.success("Next question");
                }
              }}
              disabled={currentQuestionIndex >= questions.length - 1}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <RoomAudioRenderer />
    </div>
  );
}

export default function VoiceInterviewSimulator() {
  const [state, setState] = useState<InterviewState>("setup");
  const [token, setToken] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [selectedLevel, setSelectedLevel] = useState("Mid-Level");
  const [interviewDuration, setInterviewDuration] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [spokenAnswer, setSpokenAnswer] = useState("");
  const [isListeningAnswer, setIsListeningAnswer] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const buildFallbackQuestions = (role: string, level: string): InterviewQuestion[] => [
    {
      id: "q-1",
      question: `Tell me about yourself and why you are a fit for a ${level} ${role} position.`,
      category: "behavioral",
      difficulty: "easy",
    },
    {
      id: "q-2",
      question: "Describe a challenging project you worked on and the trade-offs you made.",
      category: "technical",
      difficulty: "medium",
    },
    {
      id: "q-3",
      question: "How do you debug production issues under time pressure?",
      category: "problem-solving",
      difficulty: "medium",
    },
    {
      id: "q-4",
      question: "Explain one improvement you would make to a recent project and why.",
      category: "system-design",
      difficulty: "hard",
    },
    {
      id: "q-5",
      question: "What are your goals for the next 12 months in your career?",
      category: "behavioral",
      difficulty: "easy",
    },
  ];

  const readQuestionAloud = () => {
    const currentQuestion = questions[currentQuestionIndex]?.question;
    if (!currentQuestion || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const commitCurrentAnswer = () => {
    if (!spokenAnswer.trim()) {
      return;
    }

    setTranscript((prev) => {
      const next = [...prev];
      next[currentQuestionIndex] = spokenAnswer.trim();
      return next;
    });
  };

  const toggleAnswerListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          fullTranscript += event.results[i][0].transcript;
        }

        setSpokenAnswer((prev) => `${prev} ${fullTranscript}`.trim());
      };

      recognition.onerror = () => {
        setIsListeningAnswer(false);
      };

      recognition.onend = () => {
        setIsListeningAnswer(false);
      };

      recognitionRef.current = recognition;
    }

    if (isListeningAnswer) {
      recognitionRef.current.stop();
      setIsListeningAnswer(false);
      return;
    }

    setSpokenAnswer("");
    recognitionRef.current.start();
    setIsListeningAnswer(true);
  };

  // Timer for interview duration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === "active") {
      timer = setInterval(() => {
        setInterviewDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state === "active" && questions[currentQuestionIndex]) {
      readQuestionAloud();
    }
  }, [state, currentQuestionIndex, questions]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Start voice interview
  const startInterview = async () => {
    setState("connecting");
    try {
      // Generate interview questions (fallback locally if backend is unavailable)
      let generatedQuestions: InterviewQuestion[] = [];
      try {
        const questionsResponse = await axios.post("/api/interview-simulator/start", {
          role: selectedRole,
          level: selectedLevel,
          mode: "voice",
          numQuestions: 5,
        });
        generatedQuestions = questionsResponse.data.questions || [];
      } catch {
        generatedQuestions = buildFallbackQuestions(selectedRole, selectedLevel);
        toast.info("Using local interview questions (backend unavailable)");
      }

      if (!generatedQuestions.length) {
        generatedQuestions = buildFallbackQuestions(selectedRole, selectedLevel);
      }

      setQuestions(generatedQuestions);
      setTranscript(new Array(generatedQuestions.length).fill(""));
      setCurrentQuestionIndex(0);
      setSpokenAnswer("");

      // Create LiveKit room (voice only)
      const roomResponse = await axios.post("/api/interview-simulator/room", {
        roomName: `voice-interview-${selectedRole.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        role: selectedRole,
        level: selectedLevel,
      });

      setToken(roomResponse.data.token);
      setRoomName(roomResponse.data.roomName);
      setWsUrl(roomResponse.data.wsUrl);
      setState("active");
      setInterviewDuration(0);
      toast.success("Voice interview room created");
    } catch (error) {
      console.error("Error starting interview:", error);
      toast.error("Failed to start interview");
      setState("setup");
    }
  };

  // End interview
  const endInterview = async () => {
    setState("connecting");
    try {
      const feedbackResponse = await axios.post("/api/interview-simulator/finish", {
        responses: questions.map((q, i) => ({
          question: q.question,
          answer: transcript[i] || (i === currentQuestionIndex ? spokenAnswer : "No recorded answer"),
        })),
        mode: "voice",
        duration: Math.floor(interviewDuration / 60),
      });

      setAiFeedback(feedbackResponse.data.feedback?.summary || "");
      setState("feedback");
      toast.success("Interview completed");
    } catch (error) {
      console.error("Error ending interview:", error);
      setState("setup");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Setup Screen
  if (state === "setup") {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <Mic className="w-4 h-4" />
            <span className="text-sm font-medium">Voice-to-Voice AI Interview</span>
          </div>
          <h1 className="text-4xl font-bold">Voice Mock Interview</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Practice with real-time voice AI interviewer powered by LiveKit + Ollama Cloud.
            Natural conversation with instant feedback.
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
                  <option>Software Engineer</option>
                  <option>Frontend Developer</option>
                  <option>Backend Developer</option>
                  <option>Full Stack Developer</option>
                  <option>Data Scientist</option>
                  <option>ML Engineer</option>
                  <option>DevOps Engineer</option>
                  <option>Product Manager</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Experience Level</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background"
                >
                  <option>Intern</option>
                  <option>Junior</option>
                  <option>Mid-Level</option>
                  <option>Senior</option>
                  <option>Staff</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">Powered by:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                    <li>LiveKit WebRTC for real-time voice</li>
                    <li>Ollama Cloud (OpenAI-compatible) for AI</li>
                    <li>Natural voice-to-voice conversation</li>
                    <li>Real-time transcription & feedback</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Mic className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Before you start:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure your microphone is working</li>
                    <li>Find a quiet environment</li>
                    <li>Speak clearly and naturally</li>
                    <li>Take your time with answers</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full gap-2 text-lg"
              onClick={startInterview}
            >
              <Mic className="w-5 h-5" />
              Start Voice Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connecting Screen
  if (state === "connecting") {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 py-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Activity className="w-10 h-10 text-primary animate-pulse" />
        </motion.div>
        <h2 className="text-2xl font-bold">Connecting to interview...</h2>
        <p className="text-muted-foreground">
          Setting up your voice connection
        </p>
      </div>
    );
  }

  // Active Interview
  if (state === "active" && token && roomName && wsUrl) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="px-3 py-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <Badge variant="outline" className="bg-primary/10">
              <Mic className="w-3 h-3 mr-1" />
              Voice Mode
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {formatDuration(interviewDuration)}
            </div>
            <Button variant="ghost" size="sm" onClick={endInterview} className="text-red-500 hover:text-red-600">
              <PhoneOff className="w-4 h-4 mr-2" />
              Submit & End
            </Button>
          </div>
        </div>

        {/* LiveKit Voice Room */}
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          audio={true}
          video={false}
          connect={true}
          onDisconnected={() => {
            toast.error("Disconnected from room");
            setState("setup");
          }}
          className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl"
        >
          <InterviewRoomContent
            isSpeaking={isSpeaking}
            setIsSpeaking={setIsSpeaking}
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            setCurrentQuestionIndex={setCurrentQuestionIndex}
            spokenAnswer={spokenAnswer}
            isListeningAnswer={isListeningAnswer}
            onToggleListening={toggleAnswerListening}
            commitCurrentAnswer={commitCurrentAnswer}
            onReadQuestion={readQuestionAloud}
          />
        </LiveKitRoom>

        {/* Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Interview Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Speak clearly and at a natural pace</li>
                  <li>Take a moment to gather thoughts before answering</li>
                  <li>Use specific examples from your experience</li>
                  <li>It&apos;s okay to ask for clarification</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Feedback Screen
  if (state === "feedback") {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Interview Complete</span>
          </div>
          <h1 className="text-4xl font-bold">AI Feedback</h1>
        </motion.div>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Performance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <AIResponseFormatter content={formatAIResponse(aiFeedback)} variant="chat" />
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setState("setup")} className="flex-1">
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

  return null;
}
