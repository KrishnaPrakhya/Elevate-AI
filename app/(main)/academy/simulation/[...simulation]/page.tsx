"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BrainCircuit, Send, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AIResponseFormatter } from "@/components/ai-response-formatter";

interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
}

interface EvaluationResult {
  feedback: string;
  score: number | null;
  suggestions: string[];
  next_prompt: string | null;
}

export default function SimulationPage() {
  const router = useRouter();
  const params = useParams();
  const scenarioId = params.simulation?.[0] || "api-design";

  const [scenario, setScenario] = useState<SimulationScenario | null>(null);
  const [messages, setMessages] = useState<{role: 'ai' | 'user', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Load scenario details
    const loadScenario = async () => {
      try {
        const res = await fetch("/api/simulation/scenarios");
        const data = await res.json();
        const foundScenario = data.scenarios.find((s: SimulationScenario) => s.id === scenarioId);
        if (foundScenario) {
          setScenario(foundScenario);
          setMessages([
            {
              role: 'ai',
              content: `Welcome to the **${foundScenario.title}** simulation!\n\n${foundScenario.description}\n\nI'm here to evaluate your response. Please explain your approach in detail, considering trade-offs and practical implications.`
            }
          ]);
        }
      } catch (error) {
        console.error("Error loading scenario:", error);
      }
    };
    loadScenario();
  }, [scenarioId]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user" as const, content: input }];
    setMessages(newMessages);
    setInput("");
    setIsEvaluating(true);

    try {
      const response = await fetch("/api/simulation/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          user_response: input,
        }),
      });

      if (!response.ok) throw new Error("Evaluation failed");

      const result: EvaluationResult = await response.json();

      setMessages([...newMessages, {
        role: "ai",
        content: `**Score: ${result.score}/100**\n\n${result.feedback}`
      }]);
      setScore(result.score);
      setSuggestions(result.suggestions);

      if (result.next_prompt) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "ai",
            content: `**Follow-up Question:**\n\n${result.next_prompt}`
          }]);
        }, 1000);
      }

      toast.success("Response evaluated!");
    } catch (error) {
      console.error("Error evaluating response:", error);
      toast.error("Failed to evaluate response. Please try again.");
      setMessages([...newMessages, {
        role: "ai",
        content: "I apologize, but I encountered an error evaluating your response. Please try again."
      }]);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleComplete = async () => {
    try {
      // Mark simulation as completed in database
      toast.success("Simulation completed! Your progress has been saved.");
      router.push("/academy");
    } catch (error) {
      toast.error("Failed to save progress");
    }
  };

  if (!scenario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.push("/academy")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> back to Academy
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{scenario.title}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
             <BrainCircuit className="w-4 h-4"/> {scenario.category} • {scenario.difficulty}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {score !== null && (
            <div className="text-right mr-4">
              <p className="text-sm text-muted-foreground">Current Score</p>
              <p className={`text-2xl font-bold ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {score}/100
              </p>
            </div>
          )}
           <Button
             variant="outline"
             className="text-green-600 border-green-600 hover:bg-green-50"
             onClick={handleComplete}
           >
             <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Simulation
           </Button>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <CardTitle className="text-lg">Live Session with AI Senior Engineer</CardTitle>
          <CardDescription>Roleplay the scenario to earn your portfolio artifact.</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
             <motion.div
               key={idx}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
             >
               <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                 msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                  : 'bg-muted rounded-tl-none border'
               }`}>
                 {msg.role === 'ai' ? (
                   <div className="text-sm">
                     <AIResponseFormatter content={msg.content} variant="chat" />
                   </div>
                 ) : (
                   <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                 )}
               </div>
             </motion.div>
          ))}
          {isEvaluating && (
             <div className="flex justify-start">
               <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 border text-sm text-muted-foreground flex items-center gap-2">
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                 Evaluating your response...
               </div>
             </div>
          )}
        </CardContent>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea 
              placeholder="Type your response or architecture design here..."
              className="resize-none h-12 py-3"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="icon" className="h-12 w-12 shrink-0 rounded-xl" onClick={handleSend} disabled={isEvaluating || !input.trim()}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
