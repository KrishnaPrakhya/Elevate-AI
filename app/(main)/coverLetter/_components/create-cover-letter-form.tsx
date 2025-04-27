"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { generateCoverLetter, saveCoverLetter } from "@/actions/coverLetter";
import { toast } from "sonner";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { motion } from "framer-motion";
import CoverLetterPreview from "./cover-letter-preview";

const formSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  companyName: z.string().min(1, "Company name is required"),
  jobDescription: z.string().min(10, "Job description is required"),
  templateId: z.string().min(1, "Template ID is required"),
});

interface CreateCoverLetterFormProps {
  onSuccess: () => void;
}

export default function CreateCoverLetterForm({
  onSuccess,
}: CreateCoverLetterFormProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors},
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateId: "professional",
    },
  });

  const formValues = watch();

  const handleGenerate = async (data: z.infer<typeof formSchema>) => {
    setIsGenerating(true);
    try {
      const content = await generateCoverLetter(
        data.jobTitle,
        data.companyName,
        data.jobDescription
      );
      setGeneratedContent(content);
      setActiveTab("preview");
      toast.success("Cover letter generated successfully!");
    } catch (error) {
      toast.error("Failed to generate cover letter");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedContent) {
      toast.error("Please generate a cover letter first");
      return;
    }

    setIsSaving(true);
    try {
      await saveCoverLetter({
        content: generatedContent,
        jobTitle: formValues.jobTitle,
        jobDescription: formValues.jobDescription,
        companyName: formValues.companyName,
        templateId: formValues.templateId,
      });
      toast.success("Cover letter saved successfully!");
      onSuccess();
    } catch (error) {
      toast.error("Failed to save cover letter");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Job Details</TabsTrigger>
          <TabsTrigger value="preview" disabled={!generatedContent}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 pt-4">
          <form onSubmit={handleSubmit(handleGenerate)} className="space-y-6">
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
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="entry-level">Entry Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Cover Letter
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6 pt-4">
          {generatedContent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="p-6 bg-white">
                <CoverLetterPreview
                  content={generatedContent}
                  template={formValues.templateId}
                />
              </Card>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("details")}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Edit Details
                </Button>
                <Button
                  onClick={handleSave}
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
                      <FileText className="h-4 w-4" />
                      Save Cover Letter
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
