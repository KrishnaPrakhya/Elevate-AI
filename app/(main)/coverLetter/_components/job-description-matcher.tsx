"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Clipboard } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface JobDescriptionMatcherProps {
  jobDescription: string;
  setJobDescription: (value: string) => void;
  onTailor: () => void;
  isTailoring: boolean;
}

export function JobDescriptionMatcher({
  jobDescription,
  setJobDescription,
  onTailor,
  isTailoring,
}: JobDescriptionMatcherProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobDescription(text);
      toast.success("Job description pasted from clipboard");
    } catch (error) {
      toast.error("Failed to paste from clipboard");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-primary" />
            Job Description
          </CardTitle>
          <CardDescription>
            Paste the job description to tailor your cover letter to match the
            requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="h-64 bg-background"
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePaste} className="gap-2">
                <Clipboard className="h-4 w-4" />
                Paste from Clipboard
              </Button>
              <Button
                onClick={onTailor}
                disabled={isTailoring || !jobDescription}
                className="gap-2"
              >
                {isTailoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tailoring...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Tailor Cover Letter
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t p-4 bg-muted/20">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Our AI analyzes the job description to identify key requirements
                and skills
              </li>
              <li>
                Your cover letter content is automatically tailored to highlight
                relevant experience
              </li>
              <li>
                Keywords from the job description are incorporated to pass ATS
                systems
              </li>
            </ul>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
