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
  const fallbackResume: ResumeProps = {
    id: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "",
    content: "",
    atsScore: null,
    feedback: null,
  }

  const [resumeResult, coverLettersResult, userResult] = await Promise.allSettled([
    getResume(),
    getCoverLetters(),
    getUser(),
  ])

  if (resumeResult.status === "rejected") {
    console.error("Failed to load resume for chatbot page:", resumeResult.reason)
  }
  if (coverLettersResult.status === "rejected") {
    console.error("Failed to load cover letters for chatbot page:", coverLettersResult.reason)
  }
  if (userResult.status === "rejected") {
    console.error("Failed to load user for chatbot page:", userResult.reason)
  }

  const resume: ResumeProps =
    resumeResult.status === "fulfilled" && resumeResult.value
      ? (resumeResult.value as ResumeProps)
      : fallbackResume

  const coverLetters =
    coverLettersResult.status === "fulfilled" && Array.isArray(coverLettersResult.value)
      ? coverLettersResult.value
      : []

  const user =
    userResult.status === "fulfilled"
      ? userResult.value
      : {
          skills: [],
          industry: "",
          experience: 0,
          clerkUserId: "",
        }

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
