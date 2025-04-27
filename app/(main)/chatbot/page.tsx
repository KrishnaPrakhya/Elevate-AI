import { getResume } from "@/actions/resume";
import { getCoverLetters } from "@/actions/coverLetter";
import { getUser } from "@/actions/user";
import CareerAdvisorChat from "./_components/career-advisor-chat";
import { PageHeader } from "@/components/page-header";

export default async function CareerAdvisorPage() {
  const resume: any = await getResume();
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
