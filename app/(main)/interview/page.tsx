"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InterviewQuiz from "./_components/interviewQuiz";
import SubTopicQuiz from "./_components/subTopicQuiz";
import { getTopTopics } from "@/actions/topicQuiz";
import { InterviewSkeleton } from "@/components/loaders/skeleton-loader";
import { useState, useEffect } from "react";

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
        <TabsList>
          <TabsTrigger value="interviewQuiz">Interview Quiz</TabsTrigger>
          <TabsTrigger value="subtopicQuiz">Sub Topic Quiz</TabsTrigger>
        </TabsList>
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
