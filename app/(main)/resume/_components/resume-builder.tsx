"use client";
import {
  saveResume,
  analyzeResume,
  improveWithAI,
  tailorToJob,
} from "@/actions/resume";
import { resumeSchema } from "@/app/lib/schema";
import useFetch from "@/hooks/use-fetch";
import { useUser } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import html2pdf from "html2pdf.js/dist/html2pdf.min";
import {
  AlertTriangle,
  Download,
  Edit,
  Loader2,
  Monitor,
  Save,
  FileText,
  Sparkles,
  CheckCircle,
  XCircle,
  Briefcase,
  Palette,
  Wand2,
  Zap,
  Lightbulb,
  BarChart,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntryForm } from "./entry-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import MDEditor from "@uiw/react-md-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ResumePreview } from "./resume-preview";
import { ResumeScoreCard } from "./resume-score-card";
import { AiSuggestionCard } from "./ai-suggestions-card";
import { ResumeTemplateSelector } from "./resume-template-selector";
import { JobDescriptionMatcher } from "./job-description-matcher";

interface Props {
  initialContent: string;
}
interface ContactInfo {
  email: string;
  mobile?: string;
  linkedin?: string;
  twitter?: string;
}

interface ResumeEntry {
  title: string;
  company: string;
  startDate: string;
  endDate?: string | undefined;
  current?: boolean;
  description: string;
}
interface ResumeFormValues {
  contactInfo: ContactInfo;
  summary: string;
  skills: string;
  experience: ResumeEntry[];
  projects: ResumeEntry[];
  education: ResumeEntry[];
}

interface AISuggestion {
  id: string;
  type: "summary" | "skills" | "experience";
  section: string;
  content: string;
  reason: string;
  index?: number;
}
interface ResumeScore {
  overall: number;
  sections: {
    [key: string]: number;
  };
  suggestions: AISuggestion[];
}

function ResumeBuilder(props: Props) {
  const { initialContent } = props;
  const [activeTab, setActiveTab] = useState<string>("edit");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const { user } = useUser();
  const [resumeMode, setResumeMode] = useState<"preview" | "edit">("preview");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("modern");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumeScore, setResumeScore] = useState<ResumeScore | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [showJobMatcher, setShowJobMatcher] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const {
    control,
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResumeFormValues>({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      contactInfo: {
        email: "",
        mobile: "", // Ensure mobile is always a string
        linkedin: "",
        twitter: "",
      },
      summary: "",
      skills: "",
      experience: [],
      projects: [],
      education: [],
    },
  });

  const {
    loading: isSaving,
    fn: saveResumeFn,
    data: saveResult,
    error: saveError,
  } = useFetch(saveResume);

  const {
    loading: isAnalyzing,
    fn: analyzeResumeFn,
    data: analyzeResult,
    error: analyzeError,
  } = useFetch(analyzeResume);

  const {
    loading: isTailoring,
    fn: tailorToJobFn,
    data: tailorResult,
    error: tailorError,
  } = useFetch(tailorToJob);

  const formValues = watch();

  useEffect(() => {
    if (initialContent) {
      setActiveTab("preview");
      parseInitialContent(initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    if (activeTab === "edit") {
      const newContent = getCombinedContent();
      setPreviewContent(newContent ? newContent : initialContent);
    }
  }, [formValues, activeTab]);

  useEffect(() => {
    if (saveResult && !isSaving) {
      toast.success("Resume saved successfully!");
    }
    if (saveError) {
      toast.error(saveError.message || "Failed to save resume");
    }
  }, [saveResult, saveError, isSaving]);

  useEffect(() => {
    if (analyzeResult && !isAnalyzing) {
      setResumeScore(analyzeResult);

      // Generate AI suggestions based on analysis
      if (analyzeResult.suggestions && analyzeResult.suggestions.length > 0) {
        setAiSuggestions(analyzeResult.suggestions);
      }
    }
    if (analyzeError) {
      toast.error(analyzeError.message || "Failed to analyze resume");
    }
  }, [analyzeResult, analyzeError, isAnalyzing]);

  useEffect(() => {
    if (tailorResult && !isTailoring) {
      // Update form values with tailored content
      if (tailorResult.summary) setValue("summary", tailorResult.summary);
      if (tailorResult.skills) setValue("skills", tailorResult.skills);

      // Update experience descriptions if provided
      if (tailorResult.experience && tailorResult.experience.length > 0) {
        const currentExperience = [...formValues.experience];
        tailorResult.experience.forEach((exp: ResumeEntry, index: number) => {
          if (currentExperience[index]) {
            currentExperience[index].description = exp.description;
          }
        });
        setValue("experience", currentExperience);
      }

      toast.success("Resume tailored to job description!");
    }
    if (tailorError) {
      toast.error(tailorError.message || "Failed to tailor resume");
    }
  }, [tailorResult, tailorError, isTailoring]);

  const parseInitialContent = (content: string) => {
    try {
      const contactSection = content.match(
        /## <div align="center">(.*?)<\/div>[\s\S]*?<div align="center">([\s\S]*?)<\/div>/m
      );
      const summarySection = content.match(
        /## Professional Summary\s*\n\n([\s\S]*?)(?=\n\n##|$)/m
      );
      const skillsSection = content.match(
        /## Skills\s*\n\n([\s\S]*?)(?=\n\n##|$)/m
      );
      const experienceSection = content.match(
        /## Work Experience\s*\n\n([\s\S]*?)(?=\n\n##|$)/m
      );
      const educationSection = content.match(
        /## Education\s*\n\n([\s\S]*?)(?=\n\n##|$)/m
      );
      const projectsSection = content.match(
        /## Projects\s*\n\n([\s\S]*?)(?=\n\n##|$)/m
      );

      // Parse contact info
      if (contactSection) {
        const contactInfo = contactSection[2];

        const email = contactInfo.match(/📧 (.*?)(?=\s\||$)/m);
        const mobile = contactInfo.match(/📱 (.*?)(?=\s\||$)/m);
        const linkedin = contactInfo.match(/💼 \[LinkedIn\]$$(.*?)$$/m);
        const twitter = contactInfo.match(/🐦 \[Twitter\]$$(.*?)$$/m);

        setValue("contactInfo.email", email ? email[1] : "");
        setValue("contactInfo.mobile", mobile ? mobile[1] : "");
        setValue("contactInfo.linkedin", linkedin ? linkedin[1] : "");
        setValue("contactInfo.twitter", twitter ? twitter[1] : "");
      }

      // Set summary and skills
      if (summarySection) setValue("summary", summarySection[1]);
      if (skillsSection) setValue("skills", skillsSection[1]);

      // Parse experience entries
      if (experienceSection) {
        const experienceEntries = parseEntries(experienceSection[1]);
        setValue("experience", experienceEntries);
      }

      // Parse education entries
      if (educationSection) {
        const educationEntries = parseEntries(educationSection[1]);
        setValue("education", educationEntries);
      }

      // Parse project entries
      if (projectsSection) {
        const projectEntries = parseEntries(projectsSection[1]);
        setValue("projects", projectEntries);
      }
    } catch (error) {
      console.error("Error parsing resume content:", error);
    }
  };

  const parseEntries = (sectionContent: string) => {
    const entries = [];
    const entryRegex =
      /### (.*?) at (.*?)\s*\n\n\*\*(.*?)\*\*\s*\n\n([\s\S]*?)(?=\n\n###|$)/g;

    let match;
    while ((match = entryRegex.exec(sectionContent)) !== null) {
      const title = match[1];
      const company = match[2];
      const dateRange = match[3];
      const description = match[4];

      const startEndMatch = dateRange.match(/(.*?) - (.*)/m);
      if (startEndMatch) {
        const startDate = startEndMatch[1];
        const endDate = startEndMatch[2] || ""; // Ensure endDate is always a string
        const current = endDate === "Present";

        entries.push({
          title,
          company,
          startDate,
          endDate: current ? "" : endDate,
          current,
          description,
        });
      }
    }

    return entries;
  };

  const getContactMarkdown = () => {
    const { contactInfo } = formValues;
    const parts = [];
    if (contactInfo.email) parts.push(`📧 ${contactInfo.email}`);
    if (contactInfo.mobile) parts.push(`📱 ${contactInfo.mobile}`);
    if (contactInfo.linkedin)
      parts.push(`💼 [LinkedIn](${contactInfo.linkedin})`);
    if (contactInfo.twitter) parts.push(`🐦 [Twitter](${contactInfo.twitter})`);

    return parts.length > 0
      ? `## <div align="center">${user?.fullName}</div>
        \n\n<div align="center">\n\n${parts.join(" | ")}\n\n</div>`
      : "";
  };

  const getCombinedContent = () => {
    const { summary, skills, experience, education, projects } = formValues;
    return [
      getContactMarkdown(),
      summary && `## Professional Summary\n\n${summary}`,
      skills && `## Skills\n\n${skills}`,
      entriesToMarkdown(experience, "Work Experience"),
      entriesToMarkdown(education, "Education"),
      entriesToMarkdown(projects, "Projects"),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById("resume-pdf");
      const opt = {
        margin: [15, 15],
        filename: `${user?.fullName || "resume"}_${selectedTemplate}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async () => {
    try {
      const formattedContent = previewContent
        .replace(/\n/g, "\n")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();

      await saveResumeFn(formattedContent);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const analyzeCurrentResume = async () => {
    try {
      await analyzeResumeFn(previewContent);
    } catch (error) {
      console.error("Analysis error:", error);
    }
  };

  const tailorResumeToJob = async () => {
    if (!jobDescription) {
      toast.error("Please enter a job description");
      return;
    }

    try {
      await tailorToJobFn({
        resumeContent: previewContent,
        jobDescription,
      });
    } catch (error) {
      console.error("Tailoring error:", error);
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.type === "summary") {
      setValue("summary", suggestion.content);
    } else if (suggestion.type === "skills") {
      setValue("skills", suggestion.content);
    } else if (
      suggestion.type === "experience" &&
      suggestion.index !== undefined
    ) {
      const currentExperience = [...formValues.experience];
      if (currentExperience[suggestion.index]) {
        currentExperience[suggestion.index].description = suggestion.content;
        setValue("experience", currentExperience);
      }
    }

    // Remove the suggestion from the list
    setAiSuggestions(aiSuggestions.filter((s) => s.id !== suggestion.id));
    toast.success("Suggestion applied!");
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
                  Resume Editor
                </CardTitle>
                <CardDescription>
                  Create and customize your professional resume
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTemplateSelector(true)}
                  className="gap-1"
                >
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowJobMatcher(true)}
                  className="gap-1"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Job Match</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={analyzeCurrentResume}
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
                      <Edit className="h-4 w-4 mr-2" />
                      Form Editor
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 h-12"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Markdown
                    </TabsTrigger>
                    <TabsTrigger
                      value="final"
                      className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2 h-12"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="edit" className="p-6 m-0">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {/* Contact Information */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">
                          Contact Information
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            {...register("contactInfo.email")}
                            type="email"
                            placeholder="your@email.com"
                            className="bg-background"
                          />
                          {errors.contactInfo?.email && (
                            <p className="text-sm text-destructive">
                              {errors.contactInfo.email.message as string}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mobile">Mobile Number</Label>
                          <Input
                            id="mobile"
                            {...register("contactInfo.mobile")}
                            type="tel"
                            placeholder="+1 234 567 8900"
                            className="bg-background"
                          />
                          {errors.contactInfo?.mobile && (
                            <p className="text-sm text-destructive">
                              {errors.contactInfo.mobile.message as string}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="linkedin">LinkedIn URL</Label>
                          <Input
                            id="linkedin"
                            {...register("contactInfo.linkedin")}
                            type="url"
                            placeholder="https://linkedin.com/in/your-profile"
                            className="bg-background"
                          />
                          {errors.contactInfo?.linkedin && (
                            <p className="text-sm text-destructive">
                              {errors.contactInfo.linkedin.message as string}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="twitter">Twitter/X Profile</Label>
                          <Input
                            id="twitter"
                            {...register("contactInfo.twitter")}
                            type="url"
                            placeholder="https://twitter.com/your-handle"
                            className="bg-background"
                          />
                          {errors.contactInfo?.twitter && (
                            <p className="text-sm text-destructive">
                              {errors.contactInfo.twitter.message as string}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">
                          Professional Summary
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto gap-1"
                          onClick={() => {
                            const currentSummary = watch("summary");
                            if (!currentSummary) {
                              toast.error("Please enter a summary first");
                              return;
                            }
                            improveWithAI({
                              type: "summary",
                              current: currentSummary,
                            })
                              .then((improved) => {
                                if (improved) setValue("summary", improved);
                                toast.success("Summary improved!");
                              })
                              .catch((err) => {
                                console.log(err);
                                toast.error("Failed to improve summary");
                              });
                          }}
                        >
                          <Wand2 className="h-4 w-4" />
                          <span>Enhance with AI</span>
                        </Button>
                      </div>
                      <Controller
                        name="summary"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            className="h-32 bg-background"
                            placeholder="Write a compelling professional summary that highlights your expertise, experience, and career goals..."
                          />
                        )}
                      />
                      {errors.summary && (
                        <p className="text-sm text-destructive">
                          {errors.summary.message as string}
                        </p>
                      )}
                    </div>

                    {/* Skills */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Skills</h3>
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto gap-1"
                          onClick={() => {
                            const currentSkills = watch("skills");
                            if (!currentSkills) {
                              toast.error("Please enter skills first");
                              return;
                            }
                            improveWithAI({
                              type: "skills",
                              current: currentSkills,
                            })
                              .then((improved) => {
                                if (improved) setValue("skills", improved);
                                toast.success("Skills improved!");
                              })
                              .catch((err) => {
                                console.log(err);
                                toast.error("Failed to improve skills");
                              });
                          }}
                        >
                          <Wand2 className="h-4 w-4" />
                          <span>Enhance with AI</span>
                        </Button>
                      </div>
                      <Controller
                        name="skills"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            className="h-32 bg-background"
                            placeholder="List your key skills, technologies, and competencies. Consider organizing them by category for better readability..."
                          />
                        )}
                      />
                      {errors.skills && (
                        <p className="text-sm text-destructive">
                          {errors.skills.message as string}
                        </p>
                      )}
                    </div>

                    {/* Experience */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Work Experience</h3>
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      </div>
                      <Controller
                        name="experience"
                        control={control}
                        render={({ field }) => (
                          <EntryForm
                            type="Experience"
                            entries={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      {errors.experience && (
                        <p className="text-sm text-destructive">
                          {errors.experience.message as string}
                        </p>
                      )}
                    </div>

                    {/* Education */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Education</h3>
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      </div>
                      <Controller
                        name="education"
                        control={control}
                        render={({ field }) => (
                          <EntryForm
                            type="Education"
                            entries={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      {errors.education && (
                        <p className="text-sm text-destructive">
                          {errors.education.message as string}
                        </p>
                      )}
                    </div>

                    {/* Projects */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Projects</h3>
                        <Badge variant="secondary" className="text-xs">
                          Optional
                        </Badge>
                      </div>
                      <Controller
                        name="projects"
                        control={control}
                        render={({ field }) => (
                          <EntryForm
                            type="Project"
                            entries={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      {errors.projects && (
                        <p className="text-sm text-destructive">
                          {errors.projects.message as string}
                        </p>
                      )}
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="preview" className="p-6 m-0">
                  {activeTab === "preview" && (
                    <Button
                      variant="outline"
                      type="button"
                      className="mb-4"
                      onClick={() =>
                        setResumeMode(
                          resumeMode === "preview" ? "edit" : "preview"
                        )
                      }
                    >
                      {resumeMode === "preview" ? (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Markdown
                        </>
                      ) : (
                        <>
                          <Monitor className="h-4 w-4 mr-2" />
                          Show Preview
                        </>
                      )}
                    </Button>
                  )}

                  {activeTab === "preview" && resumeMode !== "preview" && (
                    <div className="flex p-3 gap-2 items-center border-2 border-yellow-600 text-yellow-600 rounded mb-4 bg-yellow-50 dark:bg-yellow-950/20">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">
                        You will lose edited markdown if you update the form
                        data.
                      </span>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden">
                    <MDEditor
                      value={previewContent}
                      onChange={(value) => setPreviewContent(value ?? "")}
                      height={800}
                      preview={resumeMode}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="final" className="p-6 m-0">
                  <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div>
                      <h3 className="text-lg font-medium mb-1">
                        Resume Preview
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        This is how your resume will look when downloaded as a
                        PDF
                      </p>
                    </div>
                    <Select
                      value={selectedTemplate}
                      onValueChange={setSelectedTemplate}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="classic">Classic</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="professional">
                          Professional
                        </SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border rounded-lg p-4 bg-white shadow-sm">
                    <ResumePreview
                      content={previewContent}
                      template={selectedTemplate}
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
                onClick={handleSubmit(onSubmit)}
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
                    Save Resume
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Hidden element for PDF generation */}
          <div className="hidden">
            <div id="resume-pdf">
              <ResumePreview
                content={previewContent}
                template={selectedTemplate}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Resume Score Card */}
          {resumeScore ? (
            <ResumeScoreCard
              score={{
                ...resumeScore,
                sections: Object.entries(resumeScore.sections).map(
                  ([name, score]) => ({
                    name,
                    score,
                    feedback: "", // Add appropriate feedback if available
                  })
                ),
                suggestions: resumeScore.suggestions.map(
                  (suggestion) => suggestion.content
                ),
              }}
            />
          ) : (
            <Card className="shadow-md border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary" />
                  Resume Analysis
                </CardTitle>
                <CardDescription>
                  Get AI feedback on your resume
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Analyze Your Resume
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Get AI-powered feedback on your resume&apos;s strengths and
                    weaknesses, with personalized improvement suggestions.
                  </p>
                  <Button
                    onClick={analyzeCurrentResume}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Analyze Resume
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Suggestions */}
          {aiSuggestions && aiSuggestions.length > 0 && (
            <Card className="shadow-md border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  AI Suggestions
                </CardTitle>
                <CardDescription>
                  Personalized improvements for your resume
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {aiSuggestions.map((suggestion, index) => (
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
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Resume Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Use action verbs</p>
                    <p className="text-sm text-muted-foreground">
                      Start bullet points with strong action verbs like
                      &quot;achieved,&quot; &quot;implemented,&quot; or
                      &quot;managed.&quot;
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Quantify achievements</p>
                    <p className="text-sm text-muted-foreground">
                      Include numbers and percentages to demonstrate your impact
                      (e.g., &quot;increased sales by 20%&quot;).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Tailor to job descriptions</p>
                    <p className="text-sm text-muted-foreground">
                      Customize your resume for each application by matching
                      keywords from the job posting.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Avoid generic statements</p>
                    <p className="text-sm text-muted-foreground">
                      Replace vague claims like &quot;team player&quot; with
                      specific examples that demonstrate these qualities.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Selector Dialog */}
      <Dialog
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
      >
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Choose a Resume Template</DialogTitle>
            <DialogDescription>
              Select a template that best represents your professional style
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            <ResumeTemplateSelector
              templates={[
                {
                  id: "modern",
                  name: "Modern",
                  description:
                    "Clean and contemporary design with a touch of color",
                },
                {
                  id: "classic",
                  name: "Classic",
                  description:
                    "Traditional layout that works for all industries",
                },
                {
                  id: "minimal",
                  name: "Minimal",
                  description:
                    "Simple and elegant design with plenty of white space",
                },
                {
                  id: "professional",
                  name: "Professional",
                  description: "Structured format ideal for corporate roles",
                },
                {
                  id: "creative",
                  name: "Creative",
                  description: "Bold design for creative industries",
                },
              ]}
              selectedTemplate={selectedTemplate}
              onSelect={setSelectedTemplate}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTemplateSelector(false)}>
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Description Matcher Dialog */}
      <Dialog open={showJobMatcher} onOpenChange={setShowJobMatcher}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Tailor Resume to Job Description</DialogTitle>
            <DialogDescription>
              Paste a job description to automatically tailor your resume
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <JobDescriptionMatcher
              jobDescription={jobDescription}
              setJobDescription={setJobDescription}
              onTailor={tailorResumeToJob}
              isTailoring={isTailoring}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function entriesToMarkdown(
  entries: ResumeEntry[],
  sectionTitle: string
): string {
  if (!entries || entries.length === 0) return "";

  const formatDate = (date: string | undefined) => (date ? date : "Present");

  const markdownEntries = entries.map((entry) => {
    const { title, company, startDate, endDate, current, description } = entry;
    const dateRange = `${formatDate(startDate)} - ${
      current ? "Present" : formatDate(endDate)
    }`;
    return `### ${title} at ${company}\n\n**${dateRange}**\n\n${description}`;
  });

  return `## ${sectionTitle}\n\n${markdownEntries.join("\n\n")}`;
}

export default ResumeBuilder;
