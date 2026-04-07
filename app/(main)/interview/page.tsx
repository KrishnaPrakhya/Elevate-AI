"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InterviewQuiz from "./_components/interviewQuiz";
import SubTopicQuiz from "./_components/subTopicQuiz";
import { getTopTopics } from "@/actions/topicQuiz";
import { InterviewSkeleton } from "@/components/loaders/skeleton-loader";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mic, Type, Check } from "lucide-react";

function CheckIcon() {
  return <Check className="w-4 h-4 text-emerald-500" />;
}

interface Topics {
  name: string;
  subtopics: string[];
}

export default function Page() {
  const [topics, setTopics] = useState<Topics[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopTopics()
      .then((data) => setTopics(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <InterviewSkeleton />;
  }

  return (
    <div className="container">
      <Tabs defaultValue="interviewQuiz" className="w-full min-h-screen">
        <TabsList className="mb-4">
          <TabsTrigger value="interviewQuiz">Interview Quiz</TabsTrigger>
          <TabsTrigger value="subtopicQuiz">Sub Topic Quiz</TabsTrigger>
          <TabsTrigger value="simulator">AI Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Text/Voice Simulator */}
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">AI Interview Simulator</h2>
                  <p className="text-sm text-muted-foreground">
                    Text/voice mode with adaptive questions
                  </p>
                </div>
              </div>
              <Link href="/interview/simulator">
                <Button className="w-full gap-2 mb-4">
                  <Type className="w-4 h-4" />
                  Launch Simulator
                </Button>
              </Link>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Adaptive question difficulty</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Real-time transcription</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Detailed AI feedback</span>
                </div>
              </div>
            </div>

            {/* Live Voice Simulator */}
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Mic className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Live Voice Interview</h2>
                  <p className="text-sm text-muted-foreground">
                    Local voice interview with Ollama
                  </p>
                </div>
              </div>
              <Link href="/interview/simulator-live">
                <Button className="w-full gap-2 mb-4" variant="outline">
                  <Mic className="w-4 h-4" />
                  Launch Voice Interview
                </Button>
              </Link>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Local Ollama voice agent</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Browser-based speech capture</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon />
                  <span>Private, local processing</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interviewQuiz">
          <InterviewQuiz />
        </TabsContent>
        <TabsContent value="subtopicQuiz">
          <SubTopicQuiz Topics={topics || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
