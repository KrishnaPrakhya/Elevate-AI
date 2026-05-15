"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { User, Briefcase, FileText, Loader2, Sparkles } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { updateUser } from "@/actions/user";
import { toast } from "sonner";

// Adapted simple profile schema. We omit separated industry/subIndustry since it was flattened
const profileSchema = z.object({
  industry: z
    .string({ required_error: "Please enter your industry focus" })
    .min(2, "Industry must be at least 2 characters"),
  experience: z.preprocess(
    (val) => Number.parseInt(String(val), 10),
    z
      .number()
      .min(0, "Experience cannot be negative")
      .max(50, "Experience cannot exceed 50 years"),
  ),
  bio: z.string().max(500).optional(),
  skills: z.string().transform((val) =>
    val
      ? val
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean)
      : undefined,
  ),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialUser: {
    industry?: string | null;
    experience?: number | null;
    skills?: string[];
    bio?: string | null;
    name?: string | null;
    email?: string | null;
    clerkUserId?: string | null;
    googleCalendarRefreshToken?: string | null;
  };
}

export default function ProfileForm({ initialUser }: ProfileFormProps) {
  const router = useRouter();
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);

  // Attempt to nicely pre-format skills array to a comma separated string
  const defaultSkills = initialUser.skills ? initialUser.skills.join(", ") : "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      industry: initialUser.industry || "",
      experience: String(initialUser.experience || 0),
      bio: initialUser.bio || "",
      skills: defaultSkills,
    },
  });

  const {
    loading: updateLoading,
    fn: updateUserFn,
    data: updateResult,
  } = useFetch(updateUser);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateUserFn(values);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  useEffect(() => {
    if (updateResult?.success && !updateLoading) {
      toast.success("Profile updated successfully!");
      router.refresh(); // Refresh to see new data
    }
  }, [updateResult, updateLoading, router]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Edit Profile
          </CardTitle>
          <CardDescription>
            Update your core details so Elevate AI can provide better
            personalized advice.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Industry Text Input (Simpler alternative to dropdown to allow maintaining flattened values, or could just accept text) */}
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-sm font-semibold">
                  Specialized Industry
                </Label>
                <Input
                  id="industry"
                  placeholder="e.g. tech-software-development"
                  {...register("industry")}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Changing your industry might prompt AI cache regeneration for
                  new market insights.
                </p>
                {errors.industry && (
                  <p className="text-sm text-destructive">
                    {errors.industry.message as React.ReactNode}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience" className="text-sm font-semibold">
                  Years of Experience
                </Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  max="50"
                  placeholder="e.g. 5"
                  {...register("experience")}
                  className="bg-background"
                />
                {errors.experience && (
                  <p className="text-sm text-destructive">
                    {errors.experience.message as React.ReactNode}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills" className="text-sm font-semibold">
                  Core Skills
                </Label>
                <Input
                  id="skills"
                  placeholder="e.g. Python, React, System Design"
                  {...register("skills")}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separate each skill with a comma
                </p>
                {errors.skills && (
                  <p className="text-sm text-destructive">
                    {errors.skills.message as React.ReactNode}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-semibold">
                  Professional Bio
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us a little bit about your background and goals..."
                  className="min-h-[120px] bg-background"
                  {...register("bio")}
                />
                {errors.bio && (
                  <p className="text-sm text-destructive">
                    {errors.bio.message as React.ReactNode}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={updateLoading}
              className="w-full sm:w-auto"
            >
              {updateLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to enable AI-powered scheduling for
              study sessions, interviews, and mentorship meetings.
            </p>
            {initialUser.googleCalendarRefreshToken ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Google Calendar Connected
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  AI can now create events directly in your calendar
                </p>
              </div>
            ) : (
              <>
                <Button
                  variant="default"
                  className="w-full"
                  disabled={isConnectingCalendar}
                  onClick={() => {
                    setIsConnectingCalendar(true);
                    const clerkUserId = initialUser.clerkUserId;
                    if (!clerkUserId) {
                      toast.error("User ID not found. Please sign in again.");
                      return;
                    }
                    const redirectUrl = encodeURIComponent(
                      `${window.location.origin}/profile?google_calendar=connected`,
                    );
                    const backendBaseUrl = (
                      process.env.NEXT_PUBLIC_FLASK_BACKEND_URL ||
                      "https://elevate-ai-flask.onrender.com"
                    ).replace(/\/$/, "");
                    window.location.href = `${backendBaseUrl}/api/google/connect?clerk_user_id=${clerkUserId}&next_url=${redirectUrl}`;
                  }}
                >
                  {isConnectingCalendar ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Connect Google Calendar
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  You will be redirected to Google to authorize access
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Elevate AI Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="h-3 w-3" />
                Industry Focus
              </h4>
              <p>
                Keep your industry aligned with your true target roles to get
                the best tailored insights and job matches.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Your Bio
              </h4>
              <p>
                Detailed bios help the Career Advisor pre-fill your career
                roadmap objectives automatically.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Account Info</h4>
              <p>
                Email and name are currently managed through your Clerk account
                settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
