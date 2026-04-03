"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Target,
  Rocket,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

interface PlanCheckpoint {
  label: string;
  metric: string;
  target: string;
}

interface PlanHistoryItem {
  id: string;
  version: number;
  createdAt: string;
  source: "academy" | "career-tools";
  targetRole: string;
  timelineWeeks: number;
  weeklyHours: number;
  planMarkdown: string;
  checkpoints: PlanCheckpoint[];
  planDetails: {
    topGaps: { skill: string; importance: number }[];
    topActions: { title: string; priority: string; description: string }[];
    weeklyPlan: { week: number; focus: string; goals: string[] }[];
    milestones: { week: number; achievement: string }[];
    recommendedPaths: { id: string; title: string; description: string }[];
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
  const [checkpoints, setCheckpoints] = useState<PlanCheckpoint[]>([]);
  const [history, setHistory] = useState<PlanHistoryItem[]>([]);
  const [planDetails, setPlanDetails] = useState<
    PlanHistoryItem["planDetails"] | null
  >(null);

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

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch("/api/career-planner");
        if (!response.ok) return;
        const data = await response.json();
        setHistory(data.history || []);
        if (data.activePlan) {
          setPlan(data.activePlan.planMarkdown);
          setCheckpoints(data.activePlan.checkpoints || []);
          setPlanDetails(data.activePlan.planDetails || null);
        }
      } catch (error) {
        console.error("Failed to load planner history:", error);
      }
    }
    loadHistory();
  }, []);

  const handleGeneratePlan = async () => {
    if (!targetRole.trim()) {
      toast.error("Please enter a target role");
      return;
    }

    setIsLoading(true);
    setPlan(null);
    setCheckpoints([]);
    setPlanDetails(null);

    try {
      const response = await fetch("/api/career-planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetRole,
          timelineWeeks: Number(timelineWeeks),
          weeklyHours: Number(weeklyHours),
          skillsToDevelop: skillsToAdd
            .split(",")
            .filter((s) => s.trim())
            .map((s) => s.trim()),
          focusArea,
          source: "career-tools",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate career plan");
      }

      const data = await response.json();
      setPlan(data.planMarkdown || "Unable to generate a plan right now.");
      setCheckpoints(data.checkpoints || []);
      setPlanDetails(data.savedPlan?.planDetails || null);
      if (data.savedPlan) {
        setHistory((prev) => [data.savedPlan, ...prev].slice(0, 20));
      }
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
                {userProfile.industry && (
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        Recommended for {userProfile.industry}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Leadership",
                        "System Design",
                        "Cloud Architecture",
                      ].map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => {
                            const current = skillsToAdd
                              .split(",")
                              .filter((s) => s.trim());
                            if (!current.includes(skill)) {
                              setSkillsToAdd([...current, skill].join(", "));
                            }
                          }}
                        >
                          + {skill}
                        </Badge>
                      ))}
                    </div>
                    <Link href="/academy/paths" target="_blank">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 mt-2 text-xs"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Browse all learning paths
                      </Button>
                    </Link>
                  </div>
                )}
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
                    <Checkbox
                      id="hasResume"
                      checked={!!userProfile.resume_content}
                      disabled
                    />
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
                    <Label
                      htmlFor="hasCoverLetter"
                      className="text-sm font-normal"
                    >
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

              {history.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-sm font-medium">Recent Plan Versions</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {history.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full text-left rounded-md border border-border px-2 py-2 hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setPlan(item.planMarkdown);
                          setCheckpoints(item.checkpoints || []);
                          setPlanDetails(item.planDetails || null);
                          setTargetRole(item.targetRole);
                          setTimelineWeeks(String(item.timelineWeeks));
                          setWeeklyHours(String(item.weeklyHours));
                        }}
                      >
                        <p className="text-xs font-medium">
                          V{item.version} - {item.targetRole}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()} (
                          {item.source})
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPlan(null)}
                  >
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
                      <li>
                        Projects mapped to your target role and skill gaps
                      </li>
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
                  <>
                    <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            Accelerate Your Plan with Academy
                          </span>
                        </div>
                        <Link href="/academy/paths">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                          >
                            <BookOpen className="h-3 w-3" />
                            Explore Courses
                          </Button>
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enroll in structured learning paths to achieve your
                        career goals faster
                      </p>
                    </div>
                    {planDetails ? (
                      <div className="space-y-5">
                        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-background p-3.5">
                          <p className="text-[11px] uppercase tracking-[0.15em] text-primary/80">
                            Execution Blueprint
                          </p>
                          <p className="text-sm font-semibold mt-1">
                            Role-targeted roadmap with measurable outcomes
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-background p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Top Skill Gaps
                            </p>
                            <div className="mt-3 space-y-2.5">
                              {planDetails.topGaps?.map((gap) => (
                                <div
                                  key={gap.skill}
                                  className="flex items-center justify-between rounded-md border border-primary/15 bg-background/85 px-2.5 py-2 text-sm"
                                >
                                  <span className="font-medium">
                                    {gap.skill}
                                  </span>
                                  <Badge variant="outline">
                                    {gap.importance}/10
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-background p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Milestones
                            </p>
                            <div className="mt-3 space-y-2.5 text-sm">
                              {planDetails.milestones
                                ?.slice(0, 5)
                                .map((m, idx) => (
                                  <div
                                    key={`${m.week}-${idx}`}
                                    className="rounded-md border border-border/60 bg-background/85 p-2.5"
                                  >
                                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                      Week {m.week}
                                    </p>
                                    <p className="font-medium leading-snug">
                                      {m.achievement}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                            Weekly Sprint Plan
                          </p>
                          <div className="space-y-2.5">
                            {planDetails.weeklyPlan?.slice(0, 6).map((w) => (
                              <div
                                key={w.week}
                                className="rounded-lg border border-border/60 bg-muted/20 p-3"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  Week {w.week}
                                </p>
                                <p className="text-sm font-semibold mt-1 leading-snug">
                                  {w.focus}
                                </p>
                                <ul className="list-disc pl-5 text-xs text-muted-foreground mt-1">
                                  {w.goals?.map((goal, idx) => (
                                    <li key={`${w.week}-${idx}`}>{goal}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                            Action Recommendations
                          </p>
                          <div className="space-y-2.5">
                            {planDetails.topActions
                              ?.slice(0, 5)
                              .map((action, idx) => (
                                <div
                                  key={`${action.title}-${idx}`}
                                  className="rounded-lg border border-border/60 bg-muted/20 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">
                                      {action.title}
                                    </p>
                                    <Badge variant="outline">
                                      {action.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {action.description}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2">
                        {plan}
                      </ReactMarkdown>
                    )}

                    {checkpoints.length > 0 && (
                      <div className="mt-5 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-background p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                          Measurable Checkpoints
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {checkpoints.map((checkpoint, idx) => (
                            <div
                              key={`${checkpoint.metric}-${idx}`}
                              className="rounded-md border border-primary/15 bg-background/85 p-2.5 text-xs"
                            >
                              <p className="font-semibold">
                                {checkpoint.label}
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                {checkpoint.metric}: {checkpoint.target}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
