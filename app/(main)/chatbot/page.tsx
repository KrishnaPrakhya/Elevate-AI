import { getResume } from "@/actions/resume";
import { getCoverLetters } from "@/actions/coverLetter";
import { getUser } from "@/actions/user";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
  const { userId } = await auth();
  if (!userId) {
    return redirect("/sign-in");
  }

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
          bio: "",
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
    profile_bio: user.bio || "",
    clerkUserId: userId,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] w-full">
      <CareerAdvisorChat userProfile={userProfile} />
    </div>
  );
}
