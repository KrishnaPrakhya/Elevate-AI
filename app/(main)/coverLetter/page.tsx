import { getCoverLetters } from "@/actions/coverLetter";

import CoverLetterDashboard from "./_components/cover-letter-dashboard";
import { PageHeader } from "@/components/page-header";

export default async function CoverLetterPage() {
  const coverLetters = await getCoverLetters();

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
