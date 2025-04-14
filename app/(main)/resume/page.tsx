import { PageHeader } from "@/components/page-header";
import ResumeBuilder from "./_components/resume-builder";
import { getResume } from "@/actions/resume";

type Props = {};

async function Page(props: Props) {
  const {} = props;
  const resume = await getResume();
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader
        title="AI Resume Builder"
        description="Create a professional resume with AI-powered suggestions and templates"
        align="left"
        size="lg"
        className="mb-8"
      />
      <ResumeBuilder initialContent={resume?.content} />
    </div>
  );
}

export default Page;
