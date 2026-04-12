"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Play, Clock, TrendingUp, Award, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  type: "TECHNICAL" | "BEHAVIORAL" | "SYSTEM_DESIGN";
  estimatedMinutes: number;
  primarySkill: {
    name: string;
  };
  lastAttempt?: {
    status: "completed" | "in_progress";
    score?: number;
  }[];
}

export default function SimulationsPage() {
  const router = useRouter();
  const [simulations, setSimulations] = useState<SimulationScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSimulations() {
      try {
        const res = await fetch("/api/academy/simulations");
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Simulations API not available");
            return;
          }
          throw new Error("Failed to load simulations");
        }
        const data = await res.json();
        setSimulations(data.simulations || []);
      } catch (error) {
        console.error("Error loading simulations:", error);
        toast.error("Failed to load simulations");
      } finally {
        setLoading(false);
      }
    }
    loadSimulations();
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "BEGINNER": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
      case "INTERMEDIATE": return "bg-amber-500/10 text-amber-600 border-amber-500/30";
      case "ADVANCED": return "bg-red-500/10 text-red-600 border-red-500/30";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/30";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "TECHNICAL": return "Code";
      case "BEHAVIORAL": return "MessageSquare";
      case "SYSTEM_DESIGN": return "Layers";
      default: return "BrainCircuit";
    }
  };

  const startSimulation = (id: string) => {
    router.push(`/academy/simulation/${id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/academy")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (simulations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/academy")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
          </Button>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BrainCircuit className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Simulations Available</h2>
            <p className="text-muted-foreground mb-4">
              Simulations are being prepared. Check back soon for interactive practice scenarios.
            </p>
            <Button variant="outline" onClick={() => router.push("/academy")}>
              Browse Learning Paths
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push("/academy")} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-primary" />
            Practice Simulations
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive scenarios to test your skills in real-world situations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {simulations.map((sim, idx) => (
          <motion.div
            key={sim.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="h-full flex flex-col hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sim.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {sim.primarySkill?.name || "General Skills"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={getDifficultyColor(sim.difficulty)}>
                    {sim.difficulty}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {sim.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {sim.estimatedMinutes || 15} min
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    {sim.type.replace("_", " ")}
                  </div>
                </div>

                {sim.lastAttempt && sim.lastAttempt.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last Attempt</span>
                      <span className={sim.lastAttempt[0].status === "completed" ? "text-emerald-600" : "text-amber-600"}>
                        {sim.lastAttempt[0].status === "completed" ? "Completed" : "In Progress"}
                      </span>
                    </div>
                    {sim.lastAttempt[0].score && (
                      <div className="flex items-center gap-2 mt-1">
                        <TrendingUp className="w-3 h-3 text-primary" />
                        <span className="font-medium">{sim.lastAttempt[0].score}%</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full gap-2 mt-auto"
                  onClick={() => startSimulation(sim.id)}
                >
                  <Play className="w-4 h-4" />
                  {sim.lastAttempt && sim.lastAttempt.length > 0 && sim.lastAttempt[0].status === "in_progress"
                    ? "Continue"
                    : "Start Simulation"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
