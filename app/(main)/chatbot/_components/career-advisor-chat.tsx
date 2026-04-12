"use client";

import type React from "react";
import axios from "axios";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  Bot,
  User,
  Sparkles,
  BrainCircuit,
  Briefcase,
  Calendar,
  FileText,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";
import CareerPlanGenerator from "./career-plan-generator";
import { ActionList, PendingAction } from "@/components/action-confirmation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  category?: "job" | "advice" | "schedule" | "analysis";
}

interface BackendPendingAction {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  params?: unknown;
  metadata?: {
    icon?: unknown;
    priority?: unknown;
  } | null;
}

const normalizeAssistantContent = (rawContent: unknown): string => {
  if (typeof rawContent !== "string") return "";

  let content = rawContent.trim();

  // Some backend/tool responses arrive as quoted strings with escaped newlines.
  if (
    (content.startsWith('"') && content.endsWith('"')) ||
    (content.startsWith("'") && content.endsWith("'"))
  ) {
    content = content.slice(1, -1);
  }

  content = content
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');

  // Unwrap plain markdown wrapped inside a fenced code block.
  const fencedBlockMatch = content.match(
    /^```(?:md|markdown|text)?\n([\s\S]*?)\n```$/i,
  );
  if (fencedBlockMatch?.[1]) {
    content = fencedBlockMatch[1].trim();
  }

  return content;
};

const normalizePendingActionType = (
  rawType: unknown,
): PendingAction["type"] => {
  if (typeof rawType !== "string") return "schedule";

  const normalizedType = rawType.trim().toLowerCase();

  if (normalizedType === "email" || normalizedType === "send_email") {
    return "email";
  }
  if (
    normalizedType === "calendar" ||
    normalizedType === "create_calendar_event"
  ) {
    return "calendar";
  }
  if (
    normalizedType === "mentorship" ||
    normalizedType === "schedule_mentorship"
  ) {
    return "mentorship";
  }
  if (
    normalizedType === "job_application" ||
    normalizedType === "track_job_application"
  ) {
    return "job_application";
  }

  return "schedule";
};

const normalizePendingActionMetadata = (
  rawMetadata: BackendPendingAction["metadata"],
): PendingAction["metadata"] | undefined => {
  if (!rawMetadata || typeof rawMetadata !== "object") return undefined;

  const icon =
    typeof rawMetadata.icon === "string" ? rawMetadata.icon : undefined;
  const priority =
    rawMetadata.priority === "low" ||
    rawMetadata.priority === "medium" ||
    rawMetadata.priority === "high"
      ? rawMetadata.priority
      : undefined;

  if (!icon && !priority) return undefined;

  return { icon, priority };
};

interface CareerAdvisorChatProps {
  userProfile: {
    resume_content: string;
    cover_letter_content: string;
    skills: string[];
    industry: string;
    experience_years: number;
    profile_bio: string;
    clerkUserId: string;
  };
}

export default function CareerAdvisorChat({
  userProfile,
}: CareerAdvisorChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your AI Career Advisor. I can help with career guidance, job search, resume feedback, and creating a career development plan. How can I assist you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "plan" | "profile">(
    "chat",
  );
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingActions, isLoading]);

  // Focus input on load
  useEffect(() => {
    if (activeView === "chat") {
      inputRef.current?.focus();
    }
  }, [activeView]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const userTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const timezoneOffsetMinutes = -new Date().getTimezoneOffset();

      const response = await axios.post("/api/chat", {
        message: userMessage.content,
        clerkUserId: userProfile.clerkUserId,
        timezone: userTimezone,
        timezoneOffsetMinutes,
      });
      console.log(response);
      if (!response.data) {
        throw new Error("Failed to get response from career advisor");
      }

      const data = await response.data;

      const categoryKeywords = {
        job: [
          "job search",
          "job opportunities",
          "job listings",
          "career opportunities",
        ],
        plan: [
          "career plan",
          "development plan",
          "preparation schedule",
          "learning path",
        ],
        analysis: [
          "resume analysis",
          "profile analysis",
          "cover letter feedback",
          "resume feedback",
        ],
      };

      let category: "job" | "advice" | "schedule" | "analysis" | undefined;

      if (
        data.response.toLowerCase().includes("job") &&
        categoryKeywords.job.some((kw) =>
          userMessage.content.toLowerCase().includes(kw),
        )
      ) {
        category = "job";
      } else if (
        data.response.toLowerCase().includes("plan") &&
        categoryKeywords.plan.some((kw) =>
          userMessage.content.toLowerCase().includes(kw),
        )
      ) {
        category = "schedule";
      } else if (
        (data.response.toLowerCase().includes("resume") ||
          data.response.toLowerCase().includes("profile")) &&
        categoryKeywords.analysis.some((kw) =>
          userMessage.content.toLowerCase().includes(kw),
        )
      ) {
        category = "analysis";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: normalizeAssistantContent(data.response),
        timestamp: new Date().toISOString(),
        category,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle pending actions from backend
      const backendPendingActions: BackendPendingAction[] = Array.isArray(
        data.pending_actions,
      )
        ? data.pending_actions
        : [];
      if (backendPendingActions.length > 0) {
        // Transform backend actions to frontend format
        const transformedActions: PendingAction[] = backendPendingActions.map(
          (action, index) => ({
            id: `action-${Date.now()}-${index}`,
            type: normalizePendingActionType(action.type),
            title:
              typeof action.title === "string"
                ? action.title
                : `Action ${index + 1}`,
            description:
              typeof action.description === "string"
                ? action.description
                : "A pending action requires your confirmation.",
            params:
              action.params && typeof action.params === "object"
                ? (action.params as Record<string, unknown>)
                : {},
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
            metadata: normalizePendingActionMetadata(action.metadata),
          }),
        );
        setPendingActions((prev) => [...prev, ...transformedActions]);
        toast.info(
          `${transformedActions.length} action(s) pending your confirmation`,
          {
            duration: 5000,
          },
        );
      }

      // If the response has a specific category, suggest switching to that tool
      if (category === "schedule") {
        toast.info("Would you like to create a Career Plan?", {
          action: {
            label: "Open",
            onClick: () => setActiveView("plan"),
          },
        });
      } else if (category === "analysis") {
        toast.info("Would you like to analyze your profile?", {
          action: {
            label: "Open",
            onClick: () => setActiveView("profile"),
          },
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I'm sorry, I encountered an error processing your request. Please try again later.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle action confirmation
  const handleConfirmAction = async (action: PendingAction) => {
    try {
      // Call Next.js API endpoint (not Python backend)
      const response = await axios.post("/api/actions/execute", {
        actionId: action.id,
        actionType: action.type,
        params: action.params,
        title: action.title,
        description: action.description,
      });

      if (response.data.success) {
        toast.success(`Action completed: ${action.title}`);
        // Remove confirmed action from pending list
        setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
      } else {
        toast.error(`Action failed: ${response.data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Action execution error:", error);
      toast.error("Failed to execute action");
    }
  };

  const handleCancelAction = (actionId: string) => {
    setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
    toast.info("Action cancelled");
  };

  const suggestedQuestions = [
    "What jobs match my skills?",
    "How can I improve my resume?",
    "Add a mock interview to my Google Calendar",
    "Track a new job application for me",
    "Set a follow-up reminder for this job",
    "Draft a professional follow-up email",
    "Schedule a mentorship session this week",
  ];

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "job":
        return <Briefcase className="h-4 w-4 mr-1" />;
      case "advice":
        return <Sparkles className="h-4 w-4 mr-1" />;
      case "schedule":
        return <Calendar className="h-4 w-4 mr-1" />;
      case "analysis":
        return <BrainCircuit className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-[560px] w-full max-w-6xl flex-col bg-background">
      <div className="flex items-center justify-between mb-4 px-4 py-2">
        <div className="flex items-center gap-2">
          {activeView !== "chat" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveView("chat")}
              className="mr-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="text-2xl font-bold">
            {activeView === "chat" && "Career Advisor"}
            {activeView === "plan" && "Career Plan"}
            {activeView === "profile" && "Profile Analysis"}
          </h2>
        </div>

        <div className="flex gap-2">
          <Tabs
            value={activeView}
            onValueChange={(v) =>
              setActiveView(v as "chat" | "plan" | "profile")
            }
            className="hidden md:block"
          >
            <TabsList>
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </TabsTrigger>

              <TabsTrigger value="plan" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Plan</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex md:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActiveView("chat")}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setActiveView("plan")}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActiveView("profile")}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat View */}
      {activeView === "chat" && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-sm border-0 bg-background">
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 px-4 py-5 md:px-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex max-w-[92%] gap-3 md:max-w-[85%]",
                      message.role === "user" ? "ml-auto" : "mr-auto",
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex min-w-0 flex-col gap-1">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed shadow-sm",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/70 bg-muted/65",
                        )}
                      >
                        {message.role === "assistant" ? (
                          <AIResponseFormatter
                            content={formatAIResponse(message.content)}
                            variant="chat"
                          />
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>

                      {message.category && (
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs flex items-center gap-1"
                            onClick={() => {
                              if (message.category === "schedule")
                                setActiveView("plan");
                              if (message.category === "analysis")
                                setActiveView("profile");
                            }}
                          >
                            {getCategoryIcon(message.category)}
                            <span>
                              {message.category === "job" && "Open Job Search"}
                              {message.category === "schedule" &&
                                "Create Career Plan"}
                              {message.category === "analysis" &&
                                "Analyze Profile"}
                              {message.category === "advice" && "View Advice"}
                            </span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                          </span>
                        </div>
                      )}

                      {!message.category && message.role === "assistant" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {new Date(message.timestamp).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            },
                          )}
                        </span>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="mr-auto flex max-w-[85%] gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/65 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t bg-card/60 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap gap-2 w-full">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInput(question);
                    inputRef.current?.focus();
                  }}
                >
                  {question}
                </Button>
              ))}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="flex w-full items-center gap-2"
            >
              <Input
                ref={inputRef}
                placeholder="Ask me anything about your career..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* Job Search View */}

      {/* Career Plan View */}
      {activeView === "plan" && (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-sm border-0 bg-background">
          <CareerPlanGenerator userProfile={userProfile} />
        </Card>
      )}

      {/* Pending Actions List */}
      {activeView === "chat" && pendingActions.length > 0 && (
        <div className="shrink-0">
          <ActionList
            actions={pendingActions}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        </div>
      )}
    </div>
  );
}
