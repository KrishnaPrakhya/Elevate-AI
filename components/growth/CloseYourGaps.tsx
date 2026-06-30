"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, BookOpen, Sparkles, Loader2, ArrowRight } from "lucide-react";
import {
  getRecommendedPathsForWeakAreas,
  syncMasteredSkillsToProfile,
} from "@/actions/academy-career-bridge";

type RecommendedPath = {
  id: string;
  title: string;
  description: string;
  reason: string;
};

/**
 * Surfaces the Interview -> Academy cascade: shows the user's weak areas
 * (derived from quizzes, interviews, skill mastery, and the active career plan)
 * and recommends academy learning paths that close them. Also exposes the
 * Academy -> Resume skills-sync cascade.
 */
export default function CloseYourGaps() {
  const [loading, setLoading] = useState(true);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [paths, setPaths] = useState<RecommendedPath[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    getRecommendedPathsForWeakAreas()
      .then((res) => {
        if (!active) return;
        setWeakAreas(res.weakAreas);
        setPaths(res.paths);
      })
      .catch((err) => console.error("Failed to load recommendations:", err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSyncSkills = async () => {
    setSyncing(true);
    try {
      const { addedSkills } = await syncMasteredSkillsToProfile();
      if (addedSkills.length > 0) {
        toast.success(`Added ${addedSkills.length} learned skill(s) to your profile: ${addedSkills.join(", ")}`);
      } else {
        toast.info("No new mastered skills to add yet. Keep learning in the Academy!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not sync skills right now. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing your growth signals…
        </CardContent>
      </Card>
    );
  }

  // Nothing actionable yet — keep the surface quiet rather than showing an empty box.
  if (weakAreas.length === 0 && paths.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-primary" />
          Close Your Gaps
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personalized from your quizzes, interviews, skill mastery, and career plan.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {weakAreas.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
              Focus areas
            </p>
            <div className="flex flex-wrap gap-2">
              {weakAreas.map((area) => (
                <Badge key={area} variant="secondary" className="capitalize">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {paths.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Recommended learning paths
            </p>
            {paths.map((path) => (
              <Link
                key={path.id}
                href={`/academy/paths/${path.id}`}
                className="flex items-start gap-3 rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/40"
              >
                <BookOpen className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{path.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {path.description}
                  </p>
                </div>
                <ArrowRight className="ml-auto mt-1 w-4 h-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Mastered new skills in the Academy? Add them to your resume profile.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncSkills}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="ml-1">Sync skills</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
