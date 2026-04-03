"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BrainCircuit, Send, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function SimulationPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<{role: 'ai' | 'user', content: string}[]>([
    {
      role: 'ai',
      content: "Welcome to the API Design Simulation! Your task is to design a rate-limiter for a public API. I am the Senior Engineer evaluating your proposal. Please explain your approach, the algorithms you would consider (e.g., Token Bucket, Leaky Bucket), and where you would store the state."
    }
  ]);
  const [input, setInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMessages = [...messages, { role: "user" as const, content: input }];
    setMessages(newMessages);
    setInput("");
    setIsEvaluating(true);

    // Mock AI response
    setTimeout(() => {
      setMessages([...newMessages, { 
        role: "ai", 
        content: "That's a solid start using Redis! But what happens if the Redis instance restarts? How does the Token Bucket algorithm handle burst traffic in your design?" 
      }]);
      setIsEvaluating(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.push("/academy")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> back to Academy
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Design Simulation</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
             <BrainCircuit className="w-4 h-4"/> System Design Quest
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
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
                 <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
               </div>
             </motion.div>
          ))}
          {isEvaluating && (
             <div className="flex justify-start">
               <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 border text-sm text-muted-foreground flex items-center gap-2">
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                 <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                 Evaluating logic...
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
