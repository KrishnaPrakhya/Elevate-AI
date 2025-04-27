"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
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
import ReactMarkdown from "react-markdown";
import JobSearchForm from "./job-search-form";
import CareerPlanGenerator from "./career-plan-generator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  category?: "job" | "advice" | "schedule" | "analysis";
}

interface CareerAdvisorChatProps {
  userProfile: {
    resume_content: string;
    cover_letter_content: string;
    skills: string[];
    industry: string;
    experience_years: number;
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
  const [activeView, setActiveView] = useState<
    "chat" | "job" | "plan" | "profile"
  >("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          clerkUserId: userProfile.clerkUserId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from career advisor");
      }

      const data = await response.json();

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
          userMessage.content.toLowerCase().includes(kw)
        )
      ) {
        category = "job";
      } else if (
        data.response.toLowerCase().includes("plan") &&
        categoryKeywords.plan.some((kw) =>
          userMessage.content.toLowerCase().includes(kw)
        )
      ) {
        category = "schedule";
      } else if (
        (data.response.toLowerCase().includes("resume") ||
          data.response.toLowerCase().includes("profile")) &&
        categoryKeywords.analysis.some((kw) =>
          userMessage.content.toLowerCase().includes(kw)
        )
      ) {
        category = "analysis";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
        category,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If the response has a specific category, suggest switching to that tool
      if (category === "job") {
        toast.info("Would you like to use the Job Search tool?", {
          action: {
            label: "Open",
            onClick: () => setActiveView("job"),
          },
        });
      } else if (category === "schedule") {
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

  const suggestedQuestions = [
    "What jobs match my skills?",
    "How can I improve my resume?",
    "Create a career development plan",
    "Prepare me for my Interview",
    "What skills should I develop next?",
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
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
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
            {activeView === "job" && "Job Search"}
            {activeView === "plan" && "Career Plan"}
            {activeView === "profile" && "Profile Analysis"}
          </h2>
        </div>

        <div className="flex gap-2">
          <Tabs
            value={activeView}
            onValueChange={(v) => setActiveView(v as any)}
            className="hidden md:block"
          >
            <TabsList>
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </TabsTrigger>
              <TabsTrigger value="job" className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                <span>Jobs</span>
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
              onClick={() => setActiveView("job")}
            >
              <Briefcase className="h-4 w-4" />
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
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>Career Advisor</CardTitle>
                <CardDescription>AI-powered career guidance</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-[calc(100%-8rem)] px-4">
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      message.role === "user" ? "ml-auto" : "mr-auto"
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex flex-col gap-1">
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <ReactMarkdown
                            className="prose dark:prose-invert prose-sm max-w-none"
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="text-primary hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul
                                  {...props}
                                  className="list-disc pl-6 my-2"
                                />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol
                                  {...props}
                                  className="list-decimal pl-6 my-2"
                                />
                              ),
                              li: ({ node, ...props }) => (
                                <li {...props} className="my-1" />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3
                                  {...props}
                                  className="text-base font-semibold mt-4 mb-2"
                                />
                              ),
                              h4: ({ node, ...props }) => (
                                <h4
                                  {...props}
                                  className="text-sm font-semibold mt-3 mb-1"
                                />
                              ),
                              p: ({ node, ...props }) => (
                                <p {...props} className="my-2" />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
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
                              if (message.category === "job")
                                setActiveView("job");
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
                              }
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
                            }
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
                  <div className="flex gap-3 max-w-[85%] mr-auto">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 rounded-lg p-3 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="border-t p-4 flex flex-col gap-3">
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
      {activeView === "job" && (
        <JobSearchForm onBack={() => setActiveView("chat")} />
      )}

      {/* Career Plan View */}
      {activeView === "plan" && (
        <CareerPlanGenerator
          onBack={() => setActiveView("chat")}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
