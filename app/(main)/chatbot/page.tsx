import { getResume } from "@/actions/resume";
import { getCoverLetters } from "@/actions/coverLetter";
import { getUser } from "@/actions/user";
import CareerAdvisorChat from "./_components/career-advisor-chat";
import { PageHeader } from "@/components/page-header";

interface ResumeProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  content: string;
  atsScore: number | null;
  feedback: string | null;
}
export default async function CareerAdvisorPage() {
  const resume: ResumeProps = (await getResume()) || {
    id: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "",
    content: "",
    atsScore: null,
    feedback: null,
  };
  const coverLetters = await getCoverLetters();
  const user = await getUser();

  // Prepare user profile data
  const userProfile = {
    resume_content: resume?.content || "",
    cover_letter_content:
      coverLetters?.length > 0 ? coverLetters[0].content : "",
    skills: user.skills || [],
    industry: user.industry || "",
    experience_years: user.experience || 0,
    clerkUserId: user.clerkUserId,
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader
        title="AI Career Advisor"
        description="Get personalized career guidance, job recommendations, and professional development advice"
        align="left"
        size="lg"
        className="mb-8"
      />

      <CareerAdvisorChat userProfile={userProfile} />
    </div>
  );
}
