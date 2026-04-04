"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  User,
  Send,
  Sparkles,
  BookOpen,
  Lightbulb,
  Target,
  MoreVertical,
  Trash2,
  Download,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  ExternalLink,
  Zap,
  BrainCircuit,
  ChevronRight,
  PanelLeftClose,
  PanelRightClose,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "question" | "answer" | "suggestion" | "resource";
  relatedResources?: {
    title: string;
    url: string;
    type: "lesson" | "path" | "external";
  }[];
  suggestions?: string[];
}

interface StudyCompanionProps {
  currentLessonId?: string;
  currentPathId?: string;
}

export default function StudyCompanion({
  currentLessonId,
  currentPathId,
}: StudyCompanionProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your AI Study Companion 🎓\n\nI can help you:\n• Understand complex concepts\n• Solve problems step-by-step\n• Prepare for quizzes & exams\n• Create study strategies\n\nWhat would you like to learn today?",
      timestamp: new Date().toISOString(),
      suggestions: [
        "Explain this concept simply",
        "Give me a practice problem",
        "Quiz me on this topic",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isMinimized && inputRef.current && !isFullscreen) {
      inputRef.current?.focus();
    }
  }, [isMinimized, isFullscreen]);

  // Lock body scroll when fullscreen or chat is open
  useEffect(() => {
    if (isFullscreen || !isMinimized) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen, isMinimized]);

  const sendMessage = async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
      type: "question",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await axios.post("/api/study-companion/chat", {
        message: messageContent,
        conversationId,
        currentLessonId,
        currentPathId,
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.data.response,
        timestamp: new Date().toISOString(),
        type: response.data.type || "answer",
        relatedResources: response.data.resources,
        suggestions: response.data.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.data.conversationId) {
        setConversationId(response.data.conversationId);
      }

      toast.success("Response received", {
        description: "Click on suggestions below to explore more",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error. Please try again or rephrase your question.",
          timestamp: new Date().toISOString(),
        },
      ]);
      toast.error("Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversation cleared! How can I help you with your studies today?",
        timestamp: new Date().toISOString(),
        suggestions: [
          "Explain this concept simply",
          "Give me a practice problem",
          "Quiz me on this topic",
        ],
      },
    ]);
    setConversationId(null);
    setShowSuggestions(true);
    toast.success("Conversation cleared");
  };

  const exportConversation = () => {
    const exportText = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleString()}] ${m.role === "user" ? "You" : "AI"}: ${m.content}`
      )
      .join("\n\n");

    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-session-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const suggestedQuestions = [
    "Explain this concept simply",
    "Give me a practice problem",
    "What are the key takeaways?",
    "How does this apply in real world?",
    "Quiz me on this topic",
  ];

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: { duration: 0.2 },
    },
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 25 },
    },
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: -180 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 h-16 w-16 rounded-2xl shadow-2xl z-50 bg-gradient-to-br from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90 border border-primary/20"
          size="icon"
        >
          <MessageSquare className="w-7 h-7 text-white" />
        </Button>
      </motion.div>
    );
  }

  return (
    <>
      {/* Fullscreen overlay backdrop */}
      {isFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}

      <motion.div
        ref={containerRef}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn(
          "fixed flex flex-col shadow-2xl transition-all duration-300 ease-in-out overflow-hidden",
          isFullscreen
            ? "inset-4 md:inset-6 rounded-3xl w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] h-[calc(100%-3rem)] z-50"
            : "bottom-6 right-6 w-[420px] max-h-[650px] rounded-3xl z-50",
          "border border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur-xl"
        )}
      >
        {/* Header */}
        <motion.div
          className={cn(
            "flex items-center justify-between p-4 border-b border-primary/10 flex-shrink-0",
            isFullscreen && "px-6 py-4"
          )}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-cyan-500/30 rounded-xl blur-lg" />
              <div className="relative p-2.5 bg-gradient-to-br from-primary/10 to-cyan-500/10 rounded-xl border border-primary/20">
                <Bot className="w-6 h-6 text-primary" />
              </div>
            </motion.div>
            <div>
              <h3 className="font-semibold text-lg bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
                Study Companion
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                AI-powered learning assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-primary/10"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={exportConversation}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearConversation}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(false)}
                className="h-9 w-9 hover:bg-primary/10"
                title="Exit fullscreen"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
            {!isFullscreen && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(true)}
                  className="h-9 w-9 hover:bg-primary/10"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(true)}
                  className="h-9 w-9 hover:bg-primary/10"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea
            className="flex-1 w-full"
            type="always"
            style={{ maxHeight: isFullscreen ? "calc(100vh - 140px)" : "510px", overflow: "auto" }}
          >
            <div
              className={cn(
                "p-4 space-y-4",
                isFullscreen && "px-6 py-4 max-w-4xl mx-auto"
              )}
            >
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    variants={messageVariants}
                    initial="hidden"
                    animate="visible"
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar
                      className={cn(
                        "h-9 w-9 flex-shrink-0 border-2",
                        message.role === "user"
                          ? "border-primary/30"
                          : "border-cyan-500/30"
                      )}
                    >
                      <AvatarFallback
                        className={cn(
                          message.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/80 text-white"
                            : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                        )}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <BrainCircuit className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm max-w-[80%] shadow-lg",
                        message.role === "user"
                          ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm"
                          : "border border-border/50 bg-gradient-to-br from-muted/80 to-muted/50 rounded-tl-sm"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <ReactMarkdown className="prose prose-sm dark:prose-invert prose-p:leading-relaxed">
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="leading-relaxed">{message.content}</p>
                      )}

                      {message.relatedResources &&
                        message.relatedResources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-primary/10">
                            <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              Related Resources:
                            </p>
                            <div className="space-y-1.5">
                              {message.relatedResources.map((resource, i) => (
                                <motion.a
                                  key={i}
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  whileHover={{ x: 4 }}
                                  className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-xs group"
                                >
                                  {resource.type === "lesson" ? (
                                    <div className="p-1.5 bg-emerald-500/10 rounded-md">
                                      <BookOpen className="w-3 h-3 text-emerald-600" />
                                    </div>
                                  ) : resource.type === "path" ? (
                                    <div className="p-1.5 bg-blue-500/10 rounded-md">
                                      <Target className="w-3 h-3 text-blue-600" />
                                    </div>
                                  ) : (
                                    <div className="p-1.5 bg-purple-500/10 rounded-md">
                                      <ExternalLink className="w-3 h-3 text-purple-600" />
                                    </div>
                                  )}
                                  <span className="flex-1 font-medium">
                                    {resource.title}
                                  </span>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                </motion.a>
                              ))}
                            </div>
                          </div>
                        )}

                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-primary/10">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Explore further:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {message.suggestions.map((suggestion, i) => (
                              <motion.button
                                key={i}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => sendMessage(suggestion)}
                                className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300 transition-all"
                              >
                                {suggestion}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {message.role === "assistant" && (
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-primary/10"
                              onClick={() => copyMessage(message.content)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-emerald-500/10 hover:text-emerald-600"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-red-500/10 hover:text-red-600"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <Avatar className="h-9 w-9 border-2 border-cyan-500/30">
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                      <BrainCircuit className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl px-4 py-3 border border-border/50 bg-gradient-to-br from-muted/80 to-muted/50 shadow-lg flex items-center gap-3">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: 0,
                        }}
                        className="w-2 h-2 rounded-full bg-primary"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: 0.2,
                        }}
                        className="w-2 h-2 rounded-full bg-cyan-500"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: 0.4,
                        }}
                        className="w-2 h-2 rounded-full bg-primary"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div
            className={cn(
              "border-t border-primary/10 p-4 space-y-3 bg-gradient-to-br from-background to-primary/5 flex-shrink-0",
              isFullscreen && "px-6 py-4 max-w-4xl mx-auto w-full"
            )}
          >
            {/* Quick Suggestions */}
            {showSuggestions && messages.length <= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2"
              >
                {suggestedQuestions.map((question, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(question)}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-cyan-500/10 hover:from-primary/20 hover:to-cyan-500/20 border border-primary/20 text-xs font-medium transition-all flex items-center gap-1.5 group"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500 group-hover:text-amber-600" />
                    {question}
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Input Field */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  placeholder="Ask anything about your studies..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="pr-12 py-6 rounded-xl border-primary/20 focus:border-primary/40 bg-background/50 backdrop-blur-sm transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-muted-foreground/30 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    Enter
                  </kbd>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90 shadow-lg shadow-primary/25"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
