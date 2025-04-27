import Link from "next/link";
import { ArrowLeft, Brain, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import Quiz from "../_components/Quiz";
import { PageHeader } from "@/components/page-header";

export default function MockInterviewPage() {
  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <div>
          <Link href="/interview">
            <Button
              variant="ghost"
              className="group gap-2 pl-0 hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                Back to Interview Preparation
              </span>
            </Button>
          </Link>
        </div>
        <div className="mt-2">
          <PageHeader
            title="Mock Interview Quiz"
            description="Test your knowledge with industry-specific questions tailored to your profile"
            size="lg"
            align="left"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Quiz />
        </div>

        <div className="hidden lg:block">
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-full">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold">Quiz Tips</h3>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p>Read each question carefully before answering</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p>Review explanations to understand concepts better</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p>Take your time - this isn&apos;t a speed test</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p>Focus on learning rather than just the score</p>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-xl border border-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Brain className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold">Did You Know?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Candidates who practice with mock interviews are 3x more likely
                to receive job offers. Our AI analyzes your answers to provide
                personalized improvement tips.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
