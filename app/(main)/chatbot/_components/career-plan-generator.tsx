"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Checkbox } from "@/components/ui/checkbox";

interface CareerPlanGeneratorProps {
  onBack: () => void;
  userProfile: {
    resume_content: string;
    cover_letter_content: string;
    skills: string[];
    industry: string;
    experience_years: number;
    clerkUserId: string;
  };
}

export default function CareerPlanGenerator({
  onBack,
  userProfile,
}: CareerPlanGeneratorProps) {
  const [targetRole, setTargetRole] = useState("");
  const [timelineWeeks, setTimelineWeeks] = useState("4");
  const [skillsToAdd, setSkillsToAdd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  const handleGeneratePlan = async () => {
    if (!targetRole.trim()) {
      toast.error("Please enter a target role");
      return;
    }

    setIsLoading(true);
    setPlan(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL;
      if (!backendUrl) {
        throw new Error("FLASK_BACKEND_URL environment variable is not set");
      }
      const response = await fetch(backendUrl as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `targeet_role: ${targetRole} timeline_weeks: ${timelineWeeks} skills:${
            userProfile.skills
          } skillsToDevelop: ${skillsToAdd
            .split(",")
            .filter((s) => s.trim())
            .map((s) =>
              s.trim()
            )} has_resume:${!!userProfile.resume_content} has_cover_letter : ${!!userProfile.cover_letter_content}`,

          clerkUserId: userProfile.clerkUserId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate career plan");
      }

      const data = await response.json();
      setPlan(data.schedule);
    } catch (error) {
      console.error("Error generating career plan:", error);
      toast.error("Failed to generate career plan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-200px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Career Development Plan
        </CardTitle>
        <CardDescription>
          Generate a personalized career preparation schedule
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden">
        {!plan ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetRole">Target Role</Label>
              <Input
                id="targetRole"
                placeholder="e.g., Senior Software Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timelineWeeks">Timeline (weeks)</Label>
              <Select value={timelineWeeks} onValueChange={setTimelineWeeks}>
                <SelectTrigger id="timelineWeeks">
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 weeks</SelectItem>
                  <SelectItem value="4">4 weeks</SelectItem>
                  <SelectItem value="8">8 weeks</SelectItem>
                  <SelectItem value="12">12 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillsToAdd">Skills to Develop (optional)</Label>
              <Input
                id="skillsToAdd"
                placeholder="e.g., Python, Leadership, Public Speaking"
                value={skillsToAdd}
                onChange={(e) => setSkillsToAdd(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple skills with commas
              </p>
            </div>

            <div className="pt-2">
              <p className="text-sm font-medium mb-2">
                Current Profile Status:
              </p>
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
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              <ReactMarkdown
                className="prose dark:prose-invert prose-sm max-w-none"
                components={{
                  a: ({ ...props }) => (
                    <a
                      {...props}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                  ul: ({ ...props }) => (
                    <ul {...props} className="list-disc pl-6 my-2" />
                  ),
                  ol: ({ ...props }) => (
                    <ol {...props} className="list-decimal pl-6 my-2" />
                  ),
                  li: ({ ...props }) => <li {...props} className="my-1" />,
                  h3: ({ ...props }) => (
                    <h3
                      {...props}
                      className="text-base font-semibold mt-4 mb-2"
                    />
                  ),
                  h4: ({ ...props }) => (
                    <h4
                      {...props}
                      className="text-sm font-semibold mt-3 mb-1"
                    />
                  ),
                }}
              >
                {plan}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <CardFooter className="border-t p-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>

        {!plan ? (
          <Button
            onClick={handleGeneratePlan}
            disabled={isLoading || !targetRole.trim()}
            className="gap-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Generate Plan
              </>
            )}
          </Button>
        ) : (
          <Button onClick={() => setPlan(null)}>Create New Plan</Button>
        )}
      </CardFooter>
    </Card>
  );
}
