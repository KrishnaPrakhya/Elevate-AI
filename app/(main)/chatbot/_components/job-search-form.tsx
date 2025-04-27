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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface JobSearchFormProps {
  onBack: () => void;
}

export default function JobSearchForm({ onBack }: JobSearchFormProps) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [remote, setRemote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keywords.trim()) {
      toast.error("Please enter at least one keyword");
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords: keywords.split(",").map((k) => k.trim()),
          location,
          industry: industry === "any" ? "" : industry,
          experience_level: experienceLevel,
          remote,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search for jobs");
      }

      const data = await response.json();
      setResults(data.job_results);
    } catch (error) {
      console.error("Error searching for jobs:", error);
      toast.error("Failed to search for jobs");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-200px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Job Search
        </CardTitle>
        <CardDescription>
          Find job opportunities based on your preferences
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden">
        {!results ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (skills, job titles)</Label>
              <Input
                id="keywords"
                placeholder="e.g., Software Engineer, Python, React"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple keywords with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="e.g., New York, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry (optional)</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any industry</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experienceLevel">
                Experience Level (optional)
              </Label>
              <Select
                value={experienceLevel}
                onValueChange={setExperienceLevel}
              >
                <SelectTrigger id="experienceLevel">
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any level</SelectItem>
                  <SelectItem value="entry">Entry level</SelectItem>
                  <SelectItem value="mid">Mid level</SelectItem>
                  <SelectItem value="senior">Senior level</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="remote"
                checked={remote}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setRemote(checked as boolean)
                }
              />
              <Label htmlFor="remote" className="text-sm font-normal">
                Remote positions only
              </Label>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
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
                    <ul {...props} className="list-disc pl-6 my-2" />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol {...props} className="list-decimal pl-6 my-2" />
                  ),
                  li: ({ node, ...props }) => (
                    <li {...props} className="my-1" />
                  ),
                }}
              >
                {results}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <CardFooter className="border-t p-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>

        {!results ? (
          <Button
            onClick={handleSearch}
            disabled={isLoading || !keywords.trim()}
            className="gap-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search Jobs
              </>
            )}
          </Button>
        ) : (
          <Button onClick={() => setResults(null)}>New Search</Button>
        )}
      </CardFooter>
    </Card>
  );
}
