import { getCoverLetters } from "@/actions/coverLetter";

import CoverLetterDashboard from "./_components/cover-letter-dashboard";
import { PageHeader } from "@/components/page-header";

export interface coverLetterProps {
  id: string;
  content: string;
  jobTitle: string;
  companyName: string | null;
  jobDescription: string | null;
  templateId: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}
export default async function CoverLetterPage() {
  const coverLetters: coverLetterProps[] = await getCoverLetters();
  console.log(coverLetters);
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader
        title="AI Cover Letter Builder"
        description="Create personalized cover letters tailored to specific job descriptions"
        align="left"
        size="lg"
        className="mb-8"
      />

      <CoverLetterDashboard coverLetters={coverLetters} />
    </div>
  );
}
