"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Briefcase, Code, FileText, Loader2, Sparkles } from "lucide-react";
import { onBoardingSchema } from "@/app/lib/schema";
import { PageHeader } from "@/components/page-header";
import useFetch from "@/hooks/use-fetch";
import { updateUser } from "@/actions/user";
import { toast } from "sonner";

interface Industries {
  id: string;
  name: string;
  subIndustries: string[];
}

interface Props {
  industries: Industries[];
}

function OnboardingForm(props: Props) {
  const { industries } = props;
  const [selectedIndustry, setSelectedIndustry] = useState<any>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(onBoardingSchema),
  });

  const watchIndustry = watch("industry");

  const {
    loading: updateLoading,
    fn: updateUserFn,
    data: updateResult,
  } = useFetch(updateUser);
  const onSubmit = async (values: any) => {
    try {
      const formattedIndustry = `${values.industry}-${values.subIndustry
        .toLowerCase()
        .replace(/ /g, "-")}`;
      await updateUserFn({ ...values, industry: formattedIndustry });
    } catch (error) {
      console.log("Onboarding error", error);
    }
  };

  useEffect(() => {
    console.log(updateLoading);
    console.log(updateResult);
    if (updateResult?.success && !updateLoading) {
      console.log("hiii");
      toast.success("Profile completed Successfully");
      router.push("/dashboard");
      router.refresh();
    }
  }, [updateResult, updateLoading]);
  const formVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground py-10 px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-60 h-60 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl"></div>

        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <Card className="w-full max-w-lg mx-auto form-card relative z-10">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 dark:bg-primary/10 rounded-full blur-xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-primary/5 dark:bg-primary/10 rounded-full blur-xl -z-10"></div>

        <CardContent className="p-6 md:p-8">
          <PageHeader
            title="Complete Your Profile"
            description="Select your industry to get personalized career insights and recommendations."
            align="center"
            size="md"
          />

          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 mt-8"
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="space-y-4" variants={itemVariants}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <Label htmlFor="industry" className="text-lg font-medium">
                  Industry
                </Label>
              </div>
              <Select
                onValueChange={(value) => {
                  setValue("industry", value);
                  setSelectedIndustry(
                    industries.find((ind) => ind.id === value)
                  );
                  setValue("subIndustry", "");
                }}
              >
                <SelectTrigger id="industry" className="w-full">
                  <SelectValue placeholder="Select an Industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industry && (
                <p className="text-sm text-destructive mt-1">
                  {errors.industry.message as string}
                </p>
              )}
            </motion.div>

            {watchIndustry && (
              <motion.div
                className="space-y-4"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <Label htmlFor="subIndustry" className="text-lg font-medium">
                    Specialization
                  </Label>
                </div>
                <Select
                  onValueChange={(value) => {
                    setValue("subIndustry", value);
                  }}
                >
                  <SelectTrigger id="subIndustry" className="w-full">
                    <SelectValue placeholder="Select a Specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedIndustry?.subIndustries.map((item: any) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subIndustry && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.subIndustry.message as string}
                  </p>
                )}
              </motion.div>
            )}

            <motion.div className="space-y-4" variants={itemVariants}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <Label htmlFor="experience" className="text-lg font-medium">
                  Work Experience (Years)
                </Label>
              </div>
              <Input
                id="experience"
                type="number"
                min={0}
                max={50}
                placeholder="Enter your work experience"
                className="w-full"
                {...register("experience")}
              />
              {errors.experience && (
                <p className="text-sm text-destructive mt-1">
                  {errors.experience.message as string}
                </p>
              )}
            </motion.div>

            <motion.div className="space-y-4" variants={itemVariants}>
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-5 w-5 text-primary" />
                <Label htmlFor="skills" className="text-lg font-medium">
                  Skills
                </Label>
              </div>
              <Input
                id="skills"
                placeholder="e.g., Python, TypeScript, Java"
                className="w-full"
                {...register("skills")}
              />
              <p className="text-sm text-muted-foreground">
                Enter your skills separated by commas
              </p>
              {errors.skills && (
                <p className="text-sm text-destructive mt-1">
                  {errors.skills.message as string}
                </p>
              )}
            </motion.div>

            <motion.div className="space-y-4" variants={itemVariants}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <Label htmlFor="bio" className="text-lg font-medium">
                  Professional Bio
                </Label>
              </div>
              <Textarea
                id="bio"
                placeholder="Tell us about your professional background..."
                className="h-32 w-full"
                {...register("bio")}
              />
              {errors.bio && (
                <p className="text-sm text-destructive mt-1">
                  {errors.bio.message as string}
                </p>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="pt-4">
              <Button
                className="w-full form-button group"
                disabled={updateLoading}
                type="submit"
                size="lg"
              >
                {updateLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <span className="relative z-10 flex items-center gap-2">
                    Complete Profile
                    <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.form>
        </CardContent>
      </Card>
    </div>
  );
}

export default OnboardingForm;
