"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  Lightbulb,
} from "lucide-react";
import axios from "axios";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AITutorFloatProps {
  context?: {
    lessonTitle?: string;
    lessonId?: string;
    learningPathId?: string;
  };
}

export function AITutorFloat({ context }: AITutorFloatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message when opened
  useEffect(() => {
    if (isOpen && chatMessages.length === 0) {
      setChatMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi! I'm your **AI Tutor** 👋

${
  context?.lessonTitle
    ? `I'm here to help you with: **${context.lessonTitle}**

`
    : ""
}Ask me anything about the content, and I'll help you understand it better. I can:
- Explain concepts in simpler terms
- Provide real-world examples
- Clarify confusing topics
- Quiz you on what you've learned

What would you like to know?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, context?.lessonTitle, chatMessages.length]);

  // Scroll chat to bottom when new message arrives
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
        currentLessonId: context?.lessonId,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: formatAIResponse(response.data.response),
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback response
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I'm having trouble connecting right now. Please try again in a moment!",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const suggestionChips = [
    "Explain this concept",
    "Give me an example",
    "Why is this important?",
    "How does this work?",
  ];

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <AnimatePresence>
          {!isOpen ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90"
                onClick={() => setIsOpen(true)}
              >
                <MessageSquare className="w-6 h-6" />
              </Button>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg whitespace-nowrap shadow-lg"
              >
                Ask AI Tutor
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-primary rotate-45" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-24 right-6 z-50 bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden ${
              isExpanded ? "w-[600px] h-[600px]" : "w-96 h-[500px]"
            }`}
          >
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 bg-gradient-to-r from-primary/10 to-cyan-500/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">AI Tutor</p>
                  <p className="text-xs text-muted-foreground">
                    {context?.lessonTitle
                      ? `Learning: ${context.lessonTitle}`
                      : "Here to help you learn"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
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
                        <AIResponseFormatter
                          content={formatAIResponse(message.content)}
                          variant="chat"
                        />
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
            </ScrollArea>

            {/* Suggestion Chips */}
            {chatMessages.length < 3 && (
              <div className="px-4 pb-2 flex gap-1 flex-wrap">
                {suggestionChips.map((suggestion) => (
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

            {/* Chat Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendChat()
                  }
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default AITutorFloat;
