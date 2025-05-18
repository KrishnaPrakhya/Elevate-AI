import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InterviewQuiz from "./_components/interviewQuiz";
import SubTopicQuiz from "./_components/subTopicQuiz";
import { getTopTopics } from "@/actions/topicQuiz";

async function Page() {
  const Topics = await getTopTopics();
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
          <SubTopicQuiz Topics={Topics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Page;
