"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Target, Rocket } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CareerPlanGeneratorProps {
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

export default function CareerPlanGenerator({
  userProfile,
}: CareerPlanGeneratorProps) {
  const [targetRole, setTargetRole] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState("8");
  const [skillsToAdd, setSkillsToAdd] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("8");
  const [focusArea, setFocusArea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  const derivedRoleSuggestion = useMemo(() => {
    const bio = (userProfile.profile_bio || "").trim();
    if (!bio) {
      if (userProfile.industry) {
        return `${userProfile.industry} Professional`;
      }
      return "";
    }

    const rolePatterns = [
      /(?:aspiring|target\s*role|goal|aim(?:ing)?\s*for)\s*[:\-]?\s*([A-Za-z0-9\s\-/]{4,60})/i,
      /(?:I am|I'm|working as|currently)\s+(?:an?\s+)?([A-Za-z0-9\s\-/]{4,60})/i,
    ];

    for (const pattern of rolePatterns) {
      const match = bio.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return bio.length > 60 ? bio.slice(0, 60).trim() : bio;
  }, [userProfile.profile_bio, userProfile.industry]);

  useEffect(() => {
    if (!targetRole && derivedRoleSuggestion) {
      setTargetRole(derivedRoleSuggestion);
    }
  }, [derivedRoleSuggestion, targetRole]);

  const handleGeneratePlan = async () => {
    if (!targetRole.trim()) {
      toast.error("Please enter a target role");
      return;
    }

    setIsLoading(true);
    setPlan(null);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_FLASK_BACKEND_URL ||
        process.env.NEXT_PUBLIC_FAST_API_BACKEND_URL_LOCAL;
      if (!backendUrl) {
        throw new Error(
          "NEXT_PUBLIC_FLASK_BACKEND_URL environment variable is not set"
        );
      }
      const baseUrl = backendUrl.endsWith("/")
        ? backendUrl.slice(0, -1)
        : backendUrl;

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Create a highly practical career development plan.
Target role: ${targetRole}
Timeline (weeks): ${timelineWeeks}
Available hours per week: ${weeklyHours}
Current skills: ${userProfile.skills.join(", ")}
Skills to develop: ${skillsToAdd
            .split(",")
            .filter((s) => s.trim())
            .map((s) => s.trim())
            .join(", ")}
Focus constraints: ${focusArea || "Not specified"}
Has resume: ${!!userProfile.resume_content}
Has cover letter: ${!!userProfile.cover_letter_content}`,

          clerkUserId: userProfile.clerkUserId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate career plan");
      }

      const data = await response.json();
      setPlan(data.response || "Unable to generate a plan right now.");
    } catch (error) {
      console.error("Error generating career plan:", error);
      toast.error("Failed to generate career plan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col mt-4">
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6 lg:overflow-hidden">
        <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[340px_1fr]">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 lg:h-full lg:overflow-y-auto">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target Role</Label>
                <Input
                  id="targetRole"
                  placeholder="e.g., Senior Software Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
                {derivedRoleSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    Prefilled from your onboarding profile.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timelineWeeks">Timeline (weeks)</Label>
                <Select value={timelineWeeks} onValueChange={setTimelineWeeks}>
                  <SelectTrigger id="timelineWeeks">
                    <SelectValue placeholder="Select timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 weeks</SelectItem>
                    <SelectItem value="8">8 weeks</SelectItem>
                    <SelectItem value="12">12 weeks</SelectItem>
                    <SelectItem value="16">16 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeklyHours">Available hours per week</Label>
                <Select value={weeklyHours} onValueChange={setWeeklyHours}>
                  <SelectTrigger id="weeklyHours">
                    <SelectValue placeholder="Select available hours" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="15">15 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skillsToAdd">Skills to Develop</Label>
                <Input
                  id="skillsToAdd"
                  placeholder="e.g., System Design, MLOps, CI/CD"
                  value={skillsToAdd}
                  onChange={(e) => setSkillsToAdd(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple skills with commas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="focusArea">Constraints / Focus</Label>
                <Textarea
                  id="focusArea"
                  placeholder="e.g., Working full-time, prefer project-based learning, interview in 2 months"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  className="min-h-[88px]"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-3">
                <p className="text-sm font-medium">Profile Signals</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hasResume" checked={!!userProfile.resume_content} disabled />
                    <Label htmlFor="hasResume" className="text-sm font-normal">
                      Resume available
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasCoverLetter"
                      checked={!!userProfile.cover_letter_content}
                      disabled
                    />
                    <Label htmlFor="hasCoverLetter" className="text-sm font-normal">
                      Cover letter available
                    </Label>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGeneratePlan}
                disabled={isLoading || !targetRole.trim()}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Detailed Plan...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Generate Execution Plan
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="min-h-[360px] overflow-hidden rounded-xl border border-border/70 bg-background lg:min-h-0 lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 md:px-5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Execution Roadmap</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Practical
                </Badge>
                {plan && (
                  <Button size="sm" variant="outline" onClick={() => setPlan(null)}>
                    Regenerate
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[460px] lg:h-auto lg:min-h-0 lg:flex-1">
              <div className="px-4 py-4 md:px-6 md:py-5">
                {!plan && !isLoading && (
                  <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/25 p-4">
                    <p className="text-sm font-medium">What you will get</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>Week-by-week milestones with realistic workload</li>
                      <li>Projects mapped to your target role and skill gaps</li>
                      <li>Interview prep cadence and application strategy</li>
                      <li>Measurable KPIs and weekly accountability checks</li>
                    </ul>
                  </div>
                )}

                {isLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-4 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Designing your practical career execution plan...
                  </div>
                )}

                {plan && (
                  <ReactMarkdown
                    className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2"
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                      ul: ({ ...props }) => <ul {...props} className="my-2 list-disc pl-6" />,
                      ol: ({ ...props }) => <ol {...props} className="my-2 list-decimal pl-6" />,
                      li: ({ ...props }) => <li {...props} className="my-1" />,
                      table: ({ ...props }) => (
                        <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
                          <table {...props} className="w-full text-sm" />
                        </div>
                      ),
                      th: ({ ...props }) => (
                        <th {...props} className="bg-muted px-3 py-2 text-left font-semibold" />
                      ),
                      td: ({ ...props }) => <td {...props} className="border-t px-3 py-2 align-top" />,
                    }}
                  >
                    {plan}
                  </ReactMarkdown>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
