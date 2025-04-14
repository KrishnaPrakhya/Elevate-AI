"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Check, X } from "lucide-react";
import { motion } from "framer-motion";

interface AiSuggestionCardProps {
  suggestion: {
    id: string;
    type: string;
    section: string;
    content: string;
    reason: string;
    index?: number;
  };
  onApply: () => void;
}

export function AiSuggestionCard({
  suggestion,
  onApply,
}: AiSuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm">
                  Suggestion for {suggestion.section}
                  {suggestion.type === "experience" &&
                  suggestion.index !== undefined
                    ? ` (Entry ${suggestion.index + 1})`
                    : ""}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsDismissed(true)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {suggestion.reason}
              </p>

              {isExpanded && (
                <div className="mt-2 p-3 bg-amber-100/50 dark:bg-amber-950/20 rounded-md text-sm">
                  {suggestion.content}
                </div>
              )}

              <div className="flex justify-between items-center mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs h-7 px-2"
                >
                  {isExpanded ? "Hide suggestion" : "View suggestion"}
                </Button>
                <Button
                  size="sm"
                  onClick={onApply}
                  className="h-7 gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-xs">Apply</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
