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
  Copy,
  Check,
  RotateCcw,
  Compass,
  Zap,
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

const formatIndustryLabel = (industry: string): string => {
  const knownLabels: Record<string, string> = {
    "tech-it-services": "Tech & IT Services",
  };

  if (knownLabels[industry.toLowerCase()]) {
    return knownLabels[industry.toLowerCase()];
  }

  return industry
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
        "Hello! I'm your AI Career Advisor. I can help with career guidance, job search, resume feedback, and creating a personalized career development plan. How can I assist you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "plan" | "profile">(
    "chat",
  );
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Smooth scroll scoped to container without jumping the browser window
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingActions, isLoading]);

  useEffect(() => {
    if (activeView === "chat") {
      inputRef.current?.focus();
    }
  }, [activeView]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hello! I'm your AI Career Advisor. I can help with career guidance, job search, resume feedback, and creating a career development plan. How can I assist you today?",
        timestamp: new Date().toISOString(),
      },
    ]);
    toast.info("Conversation reset");
  };

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

      if (!response.data) {
        throw new Error("Failed to get response from career advisor");
      }

      const data = response.data;

      const categoryKeywords = {
        job: [
          "job search",
          "job opportunities",
          "job listings",
          "career opportunities",
          "hiring",
        ],
        plan: [
          "career plan",
          "development plan",
          "preparation schedule",
          "learning path",
          "roadmap",
        ],
        analysis: [
          "resume analysis",
          "profile analysis",
          "cover letter feedback",
          "resume feedback",
          "resume review",
        ],
      };

      let category: "job" | "advice" | "schedule" | "analysis" | undefined;

      const respLower = (data.response || "").toLowerCase();
      const msgLower = userMessage.content.toLowerCase();

      if (
        respLower.includes("job") &&
        categoryKeywords.job.some((kw) => msgLower.includes(kw))
      ) {
        category = "job";
      } else if (
        respLower.includes("plan") &&
        categoryKeywords.plan.some((kw) => msgLower.includes(kw))
      ) {
        category = "schedule";
      } else if (
        (respLower.includes("resume") || respLower.includes("profile")) &&
        categoryKeywords.analysis.some((kw) => msgLower.includes(kw))
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

      const backendPendingActions: BackendPendingAction[] = Array.isArray(
        data.pending_actions,
      )
        ? data.pending_actions
        : [];
      if (backendPendingActions.length > 0) {
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
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            metadata: normalizePendingActionMetadata(action.metadata),
          }),
        );
        setPendingActions((prev) => [...prev, ...transformedActions]);
        toast.info(
          `${transformedActions.length} action(s) pending your confirmation`,
          { duration: 5000 },
        );
      }

      if (category === "schedule") {
        toast.info("Would you like to generate a detailed Career Plan?", {
          action: {
            label: "Open Plan",
            onClick: () => setActiveView("plan"),
          },
        });
      } else if (category === "analysis") {
        toast.info("Would you like to analyze your profile?", {
          action: {
            label: "Open Profile",
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
            "I'm sorry, I encountered an error processing your request. Please check your connection and try again.",
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

  const handleConfirmAction = async (action: PendingAction) => {
    try {
      const response = await axios.post("/api/actions/execute", {
        actionId: action.id,
        actionType: action.type,
        params: action.params,
        title: action.title,
        description: action.description,
      });

      if (response.data.success) {
        toast.success(`Action completed: ${action.title}`);
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

  const promptCategories = [
    {
      label: "Job Search",
      icon: Briefcase,
      query: "Find hiring job opportunities matching my skills",
    },
    {
      label: "Resume Review",
      icon: FileText,
      query: "How can I improve my resume for ATS and recruiters?",
    },
    {
      label: "Mock Interview",
      icon: Calendar,
      query: "Schedule a mock interview on my calendar for this week",
    },
    {
      label: "30-Day Plan",
      icon: Compass,
      query: "Build a 30-day preparation schedule for my career goals",
    },
    {
      label: "Draft Email",
      icon: Zap,
      query: "Draft a professional follow-up email after an interview",
    },
  ];

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "job":
        return <Briefcase className="h-3.5 w-3.5 mr-1" />;
      case "advice":
        return <Sparkles className="h-3.5 w-3.5 mr-1" />;
      case "schedule":
        return <Calendar className="h-3.5 w-3.5 mr-1" />;
      case "analysis":
        return <BrainCircuit className="h-3.5 w-3.5 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] w-full max-w-6xl flex-col bg-background/95 backdrop-blur-md rounded-2xl border border-border/70 shadow-lg overflow-hidden">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 bg-card/60">
        <div className="flex items-center gap-3">
          {activeView !== "chat" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveView("chat")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">
                  {activeView === "chat" && "AI Career Advisor"}
                  {activeView === "plan" && "Career Roadmap Generator"}
                  {activeView === "profile" && "Profile Analysis"}
                </h2>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Agent
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {userProfile.industry
                  ? `${formatIndustryLabel(userProfile.industry)} • ${userProfile.experience_years} ${userProfile.experience_years === 1 ? "year" : "years"} experience`
                  : "Personalized Career Intelligence"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeView === "chat" && messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1 hidden sm:flex"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}

          <Tabs
            value={activeView}
            onValueChange={(v) =>
              setActiveView(v as "chat" | "plan" | "profile")
            }
          >
            <TabsList className="bg-muted/70 h-8 p-0.5">
              <TabsTrigger value="chat" className="text-xs px-3 h-7 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="plan" className="text-xs px-3 h-7 gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Plan</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Chat View */}
      {activeView === "chat" && (
        <Card className="flex flex-1 flex-col overflow-hidden border-0 shadow-none bg-transparent rounded-none">
          <CardContent className="flex-1 overflow-hidden p-0 relative">
            <ScrollArea className="h-full">
              <div className="space-y-5 px-4 py-6 md:px-8 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 md:gap-4 transition-all duration-200",
                      message.role === "user"
                        ? "justify-end ml-auto max-w-[88%] md:max-w-[78%]"
                        : "justify-start mr-auto max-w-[95%] md:max-w-[88%]",
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 mt-0.5 shrink-0 border border-primary/20 shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div
                        className={cn(
                          "relative group rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm transition-all",
                          message.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-xs"
                            : "bg-card/90 border border-border/80 text-card-foreground rounded-tl-xs hover:border-border",
                        )}
                      >
                        {message.role === "assistant" ? (
                          <>
                            <AIResponseFormatter
                              content={formatAIResponse(message.content)}
                              variant="chat"
                            />
                            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                              <span>
                                {new Date(message.timestamp).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  handleCopyMessage(message.id, message.content)
                                }
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <span className="block mt-1 text-[10px] text-primary-foreground/75 text-right">
                              {new Date(message.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      {message.category && message.role === "assistant" && (
                        <div className="flex items-center gap-1.5 ml-1">
                          <Badge
                            variant="secondary"
                            className="text-[11px] cursor-pointer hover:bg-secondary/80 transition-colors flex items-center gap-1 px-2.5 py-0.5"
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
                              {message.category === "advice" && "View Guidance"}
                            </span>
                          </Badge>
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 mt-0.5 shrink-0 border border-border/60">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="mr-auto flex max-w-[85%] gap-3 items-start">
                    <Avatar className="h-8 w-8 mt-0.5 shrink-0 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4 animate-pulse" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-xs border border-border/80 bg-card/90 px-4 py-3 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          {/* Footer Input Area */}
          <CardFooter className="flex flex-col gap-2.5 border-t border-border/60 bg-card/50 p-3.5 sm:p-4 backdrop-blur-md">
            {/* Quick Suggestion Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 scrollbar-none">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0 hidden sm:inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Quick Prompts:
              </span>
              {promptCategories.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-full border-border/70 bg-background/80 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shrink-0 px-2.5 gap-1.5"
                    onClick={() => {
                      setInput(item.query);
                      inputRef.current?.focus();
                    }}
                  >
                    <Icon className="h-3 w-3 text-primary/70" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="flex w-full items-center gap-2"
            >
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  placeholder="Ask anything about jobs, resumes, career roadmaps, or interview prep..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1 bg-background/90 pr-10 border-border/80 focus-visible:ring-primary/30 rounded-xl text-sm h-10 shadow-inner"
                />
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="h-10 w-10 rounded-xl shadow-md bg-primary hover:bg-primary/90 transition-transform active:scale-95 shrink-0"
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

      {/* Career Plan View */}
      {activeView === "plan" && (
        <Card className="flex flex-1 flex-col overflow-hidden border-0 shadow-none bg-transparent rounded-none">
          <CareerPlanGenerator userProfile={userProfile} />
        </Card>
      )}

      {/* Pending Actions List */}
      {activeView === "chat" && pendingActions.length > 0 && (
        <div className="shrink-0 border-t border-border/60 bg-muted/30 p-2">
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
