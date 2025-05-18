"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyzeCoverLetter,
  saveCoverLetter,
  tailorToJobCoverLetter,
} from "@/actions/coverLetter";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  FileText,
  Save,
  Download,
  BarChart,
  Wand2,
  Briefcase,
} from "lucide-react";
import CoverLetterPreview from "./cover-letter-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoverLetterScoreCard } from "./cover-letter-score-card";
import { JobDescriptionMatcher } from "./job-description-matcher";
import MDEditor from "@uiw/react-md-editor";
import { AiSuggestionCard } from "./ai-suggestions-card";
import { coverLetterProps } from "../page";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

const formSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  companyName: z.string().min(1, "Company name is required"),
  jobDescription: z.string().min(10, "Job description is required"),
  templateId: z.string().min(1, "Template ID is required"),
  content: z.string().min(10, "Cover letter content is required"),
});

interface CoverLetterEditorProps {
  coverLetter: coverLetterProps;
}

export default function CoverLetterEditor({
  coverLetter,
}: CoverLetterEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [coverLetterContent, setCoverLetterContent] = useState(
    coverLetter.content
  );
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<analyseResultProps | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<suggestionsProp[]>([]);
  const [showJobMatcherDialog, setShowJobMatcherDialog] = useState(false);
  const [jobDescription, setJobDescription] = useState(
    coverLetter.jobDescription || ""
  );
  const [editorMode, setEditorMode] = useState<"preview" | "edit">("preview");

  interface suggestionsProp {
    id: string;
    type: string;
    section: string;
    content: string;
    reason: string;
  }

  interface analyseResultProps {
    overall: number;
    sections: {
      feedback: string;
      name: string;
      score: number;
    }[];
    suggestions: {
      id: string;
      type: string;
      section: string;
      content: string;
      reason: string;
    }[];
  }
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: coverLetter.jobTitle,
      companyName: coverLetter.companyName || "",
      jobDescription: coverLetter.jobDescription || "",
      templateId: coverLetter.templateId || "",
      content: coverLetter.content,
    },
  });

  const formValues = watch();

  useEffect(() => {
    setValue("content", coverLetterContent);
  }, [coverLetterContent, setValue]);

  const handleSave = async (data: z.infer<typeof formSchema>) => {
    setIsSaving(true);
    try {
      await saveCoverLetter({
        content: data.content,
        jobTitle: data.jobTitle,
        jobDescription: data.jobDescription,
        companyName: data.companyName,
        templateId: data.templateId,
      });
      toast.success("Cover letter saved successfully!");
      router.push("/coverLetter");
      router.refresh();
    } catch (error) {
      toast.error("Failed to save cover letter");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result: analyseResultProps = await analyzeCoverLetter(
        coverLetterContent
      );
      console.log(result);
      setAnalysisResult(result);

      // Generate AI suggestions based on analysis
      if (result.suggestions && result.suggestions.length > 0) {
        setAiSuggestions(
          Array.isArray(result.suggestions)
            ? result.suggestions
            : [result.suggestions]
        );
      }

      setShowAnalysisDialog(true);
      toast.success("Cover letter analyzed successfully!");
    } catch (error) {
      toast.error("Failed to analyze cover letter");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTailorToJob = async () => {
    if (!jobDescription) {
      toast.error("Please enter a job description");
      return;
    }

    setIsTailoring(true);
    try {
      const result = await tailorToJobCoverLetter({
        coverLetterContent,
        jobDescription,
      });

      if (result.introduction)
        setCoverLetterContent((prev: string) =>
          prev.replace(`/^(.*?\n\n)/`, `${result.introduction}\n\n`)
        );
      if (result.body) {
        const bodyRegex = `/^(.*?\n\n)(.*?)(\n\n.*?$)/s`;
        setCoverLetterContent((prev: string) =>
          prev.replace(bodyRegex, `$1${result.body}$3`)
        );
      }
      if (result.closing) {
        const closingRegex = `/(\n\n[^]*?)$/`;
        setCoverLetterContent((prev: string) =>
          prev.replace(closingRegex, `\n\n${result.closing}`)
        );
      }

      setShowJobMatcherDialog(false);
      toast.success("Cover letter tailored to job description!");
    } catch (error) {
      toast.error("Failed to tailor cover letter");
      console.error(error);
    } finally {
      setIsTailoring(false);
    }
  };

  const applySuggestion = (suggestion: suggestionsProp) => {
    if (suggestion.type === "introduction") {
      const introRegex = `/^(.*?\n\n)/`;
      setCoverLetterContent((prev: string) =>
        prev.replace(introRegex, `${suggestion.content}\n\n`)
      );
    } else if (suggestion.type === "body") {
      const bodyRegex = `/^(.*?\n\n)(.*?)(\n\n.*?$)/s`;
      setCoverLetterContent((prev: string) =>
        prev.replace(bodyRegex, `$1${suggestion.content}$3`)
      );
    } else if (suggestion.type === "closing") {
      const closingRegex = /(\n\n[^]*?)$/;
      setCoverLetterContent((prev: string) =>
        prev.replace(closingRegex, `\n\n${suggestion.content}`)
      );
    }

    // Remove the suggestion from the list
    setAiSuggestions(aiSuggestions.filter((s) => s.id !== suggestion.id));
    toast.success("Suggestion applied!");
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById("cover-letter-pdf");
      if (!element) throw new Error("cover-letter PDF element not found");

      // Define PDF dimensions (A4 = 210 x 297 mm)
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Use html2canvas with no scaling (or lower scale)
      const canvas = await html2canvas(element, {
        scale: 2, // try with scale: 1 or 1.5
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Ensure it fits on one page (you can add multipage logic later if needed)
      const y = 0;
      if (imgHeight > pdfHeight) {
        // If image height is more than page, shrink to fit height instead
        const scaledWidth = (pdfHeight * imgProps.width) / imgProps.height;
        pdf.addImage(
          imgData,
          "PNG",
          (pdfWidth - scaledWidth) / 2,
          0,
          scaledWidth,
          pdfHeight
        );
      } else {
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
      }

      pdf.save("cover-letter.pdf");
      toast.success("PDF generated successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div data-color-mode="light" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-md border-primary/20">
            <CardHeader className="pb-4 flex flex-row justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Cover Letter Editor
                </CardTitle>
                <CardDescription>
                  Edit and customize your cover letter
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowJobMatcherDialog(true)}
                  className="gap-1"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Job Match</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="gap-1"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Analyze</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="px-6 border-b">
                  <TabsList className="w-full justify-start h-12 bg-transparent p-0">
                    <TabsTrigger
                      value="edit"
                      className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 h-12"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Edit Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="content"
                      className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 h-12"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Content
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 h-12"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="edit" className="p-6 m-0">
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Title</Label>
                        <Input
                          id="jobTitle"
                          placeholder="e.g. Software Engineer"
                          {...register("jobTitle")}
                        />
                        {errors.jobTitle && (
                          <p className="text-sm text-destructive">
                            {errors.jobTitle.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          placeholder="e.g. Acme Corporation"
                          {...register("companyName")}
                        />
                        {errors.companyName && (
                          <p className="text-sm text-destructive">
                            {errors.companyName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="jobDescription">Job Description</Label>
                      <Textarea
                        id="jobDescription"
                        placeholder="Paste the job description here..."
                        className="h-40"
                        {...register("jobDescription")}
                      />
                      {errors.jobDescription && (
                        <p className="text-sm text-destructive">
                          {errors.jobDescription.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="templateId">Template Style</Label>
                      <Select
                        onValueChange={(value) => setValue("templateId", value)}
                        defaultValue={formValues.templateId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">
                            Professional
                          </SelectItem>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="creative">Creative</SelectItem>
                          <SelectItem value="executive">Executive</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="entry-level">
                            Entry Level
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="content" className="p-6 m-0">
                  {activeTab === "content" && (
                    <Button
                      variant="outline"
                      type="button"
                      className="mb-4"
                      onClick={() =>
                        setEditorMode(
                          editorMode === "preview" ? "edit" : "preview"
                        )
                      }
                    >
                      {editorMode === "preview" ? (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Edit Markdown
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Show Preview
                        </>
                      )}
                    </Button>
                  )}
                  <div className="border rounded-lg overflow-hidden">
                    <MDEditor
                      value={coverLetterContent}
                      onChange={(value) => setCoverLetterContent(value || "")}
                      height={600}
                      preview={editorMode}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="p-6 m-0">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-1">
                      Cover Letter Preview
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This is how your cover letter will look when downloaded as
                      a PDF
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 bg-white shadow-sm">
                    <CoverLetterPreview
                      content={coverLetterContent}
                      template={formValues.templateId}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6 bg-muted/20">
              <Button
                variant="outline"
                onClick={generatePDF}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button
                onClick={handleSubmit(handleSave)}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Cover Letter
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <div id="cover-letter-pdf">
              <MDEditor.Markdown
                source={coverLetterContent}
                style={{ background: "white", color: "black" }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* AI Suggestions */}
          {aiSuggestions && aiSuggestions.length > 0 && (
            <Card className="shadow-md border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  AI Suggestions
                </CardTitle>
                <CardDescription>
                  Personalized improvements for your cover letter
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {aiSuggestions.map((suggestion: suggestionsProp, index) => (
                    <AiSuggestionCard
                      key={index}
                      suggestion={suggestion}
                      onApply={() => applySuggestion(suggestion)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          <Card className="shadow-md border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Cover Letter Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="mt-0.5">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Wand2 className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Personalize for each job</p>
                    <p className="text-sm text-muted-foreground">
                      Tailor your cover letter to each specific job and company
                      to show genuine interest.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="mt-0.5">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Wand2 className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Address specific requirements</p>
                    <p className="text-sm text-muted-foreground">
                      Highlight how your skills and experience match the key
                      requirements in the job description.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="mt-0.5">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Wand2 className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Show enthusiasm</p>
                    <p className="text-sm text-muted-foreground">
                      Express genuine interest in the role and company to stand
                      out from other applicants.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="mt-0.5">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Wand2 className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Keep it concise</p>
                    <p className="text-sm text-muted-foreground">
                      Aim for 3-4 paragraphs and no more than one page to
                      respect the reader&apos;s time.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cover Letter Analysis</DialogTitle>
            <DialogDescription>
              AI-powered feedback and suggestions for your cover letter
            </DialogDescription>
          </DialogHeader>
          {analysisResult && (
            <CoverLetterScoreCard
              score={{
                ...analysisResult,
                suggestions: analysisResult.suggestions.map(
                  (suggestion) => suggestion.content
                ),
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Job Matcher Dialog */}
      <Dialog
        open={showJobMatcherDialog}
        onOpenChange={setShowJobMatcherDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tailor Cover Letter to Job Description</DialogTitle>
            <DialogDescription>
              Paste a job description to automatically tailor your cover letter
            </DialogDescription>
          </DialogHeader>
          <JobDescriptionMatcher
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            onTailor={handleTailorToJob}
            isTailoring={isTailoring}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
