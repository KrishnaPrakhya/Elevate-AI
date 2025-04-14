import { getCoverLetterById } from "@/actions/coverLetter";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import CoverLetterEditor from "../../_components/cover-letter-editor";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function EditCoverLetterPage({ params }: PageProps) {
  const { id } = params;
  const coverLetter = await getCoverLetterById(id);

  if (!coverLetter) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader
        title="Edit Cover Letter"
        description="Customize and improve your cover letter"
        align="left"
        size="lg"
        className="mb-8"
      />

      <CoverLetterEditor coverLetter={coverLetter} />
    </div>
  );
}
