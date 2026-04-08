"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";
import {
  BookOpen,
  ArrowLeft,
  Loader2,
  Brain,
  ChevronRight,
  MessageSquare,
  Sparkles,
  X,
  Send,
  Maximize2,
  Minimize2,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import { generateTopicContent } from "@/actions/topicQuiz";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function InterviewLearnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>("");
  const [showChat, setShowChat] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadedTopicsKeyRef = useRef<string>("");

  const topicsParam = searchParams.get("topics") || "";
  const topics = useMemo(
    () =>
      topicsParam
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    [topicsParam],
  );
  const topicTitle =
    topics.length > 1 ? "Multiple Topics" : topics[0] || "Learning";

  useEffect(() => {
    async function loadContent() {
      if (lastLoadedTopicsKeyRef.current === topicsParam) {
        return;
      }

      if (topics.length === 0) {
        toast.error("No topics selected");
        router.push("/interview");
        return;
      }

      lastLoadedTopicsKeyRef.current = topicsParam;

      try {
        const generatedContent = await generateTopicContent(topics);
        setContent(generatedContent);

        // Initialize chat with context
        setChatMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hi! I'm your AI tutor for this learning session.

**Topics you're learning:**
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Ask me anything about these topics, and I'll help you understand them better!`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error("Error generating content:", error);
        toast.error("Failed to generate learning content");
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [topicsParam, topics, router]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isSending]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsSending(true);

    try {
      const response = await axios.post("/api/study-companion/chat", {
        message: chatInput,
        context: `Learning topics: ${topics.join(", ")}`,
        conversationId: conversationId || undefined,
      });

      // Store conversation ID for follow-up messages
      if (response.data.conversationId && !conversationId) {
        setConversationId(response.data.conversationId);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: formatAIResponse(response.data.response),
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get response from tutor");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-blue-950/30">
      {/* Top Navigation */}
      <div className="sticky top-0 z-10 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/interview")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Quiz
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold">{topicTitle}</h1>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Tutor
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div
          className={`transition-all duration-300 ${showChat ? "lg:mr-96" : ""}`}
        >
          {/* Topics Breadcrumb */}
          <div className="flex flex-wrap gap-2 mb-6">
            {topics.map((topic, index) => (
              <Badge key={topic} variant="outline" className="text-sm">
                {topic}
              </Badge>
            ))}
          </div>

          {/* Learning Content */}
          <Card className="border-primary/20 bg-white dark:bg-slate-900">
            <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-cyan-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Learning Content</CardTitle>
                  <CardDescription>
                    AI-generated content for your selected topics
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)] p-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <AIResponseFormatter
                    content={formatAIResponse(content)}
                    variant="default"
                  />
                </motion.div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => router.push("/interview")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quiz Selection
            </Button>
            <Button
              onClick={() =>
                router.push(`/interview/mockQuiz?topics=${topics.join(",")}`)
              }
              className="gap-2"
            >
              <Brain className="w-4 h-4" />
              Start Quiz
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* AI Tutor Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isChatExpanded ? 600 : 384, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] border-l bg-white dark:bg-slate-900 flex flex-col z-10"
          >
            {/* Chat Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 bg-gradient-to-r from-primary/10 to-cyan-500/10 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">AI Tutor</p>
                  <p className="text-xs text-muted-foreground">
                    Ask anything about the content
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                >
                  {isChatExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
              <div className="space-y-4 min-h-full">
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted border rounded-bl-sm"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm leading-relaxed">
                          <AIResponseFormatter
                            content={formatAIResponse(message.content)}
                            variant="chat"
                          />
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3 border text-sm text-muted-foreground flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                      Tutor is thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t bg-background shrink-0">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendChat()
                  }
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent"
                  disabled={isSending}
                />
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={isSending || !chatInput.trim()}
                  className="shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {chatMessages.length <= 1 && (
                <div className="flex gap-1 flex-wrap">
                  {[
                    "Explain this concept",
                    "Give me an example",
                    "Why is this important?",
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setChatInput(suggestion)}
                    >
                      <Lightbulb className="w-3 h-3 mr-1" />
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
