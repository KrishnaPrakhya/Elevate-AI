"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, X, Target, Code, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { industries } from "@/data/industries";
import { updateUserProfile, getUserProfile } from "@/actions/user";
import {
  getIndustryOptions,
  getRoleOptionsByIndustry,
} from "@/actions/profile-options";
import useFetch from "@/hooks/use-fetch";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  industry: string | null;
  targetRole: string | null;
  experience: number | null;
  skills: string[];
  bio: string | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editedIndustry, setEditedIndustry] = useState<string>("");
  const [editedRole, setEditedRole] = useState<string>("");
  const [editedSkills, setEditedSkills] = useState<string>("");
  const [industryOptions, setIndustryOptions] = useState(industries);
  const [availableRoles, setAvailableRoles] = useState<
    { id: string; title: string }[]
  >([]);

  const { loading: profileLoading, fn: loadProfile } = useFetch(getUserProfile);
  const { loading: saveLoading, fn: saveProfile } = useFetch(updateUserProfile);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadProfile(),
      getIndustryOptions().catch(() => industries),
    ]).then(([data, dynamicIndustries]) => {
      if (cancelled) return;

      if (dynamicIndustries.length > 0) {
        setIndustryOptions(dynamicIndustries);
      }

      if (data) {
        setProfile(data);
        setEditedIndustry(data.industry?.split("-")[0] || "");
        setEditedRole(data.targetRole || "");
        setEditedSkills(data.skills?.join(", ") || "");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    if (editedIndustry) {
      getRoleOptionsByIndustry(editedIndustry)
        .then((roles) => {
          if (cancelled) return;

          const hasCurrentRole =
            !editedRole || roles.some((role) => role.title === editedRole);

          setAvailableRoles(
            hasCurrentRole
              ? roles
              : [
                  {
                    id: `custom-${editedRole.toLowerCase().replace(/\s+/g, "-")}`,
                    title: editedRole,
                  },
                  ...roles,
                ],
          );
        })
        .catch(() => {
          if (!cancelled) {
            setAvailableRoles(
              editedRole
                ? [
                    {
                      id: `custom-${editedRole.toLowerCase().replace(/\s+/g, "-")}`,
                      title: editedRole,
                    },
                  ]
                : [],
            );
          }
        });
    } else {
      setAvailableRoles([]);
    }

    return () => {
      cancelled = true;
    };
  }, [editedIndustry, editedRole]);

  const handleSave = async () => {
    try {
      const skills = editedSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await saveProfile({
        industry: profile?.industry?.startsWith(editedIndustry)
          ? profile.industry
          : editedIndustry,
        targetRole: editedRole || undefined,
        skills,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              industry: prev.industry?.startsWith(editedIndustry)
                ? prev.industry
                : editedIndustry,
              targetRole: editedRole || null,
              skills,
            }
          : null,
      );

      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    }
  };

  const handleAddSkill = (skill: string) => {
    if (
      skill.trim() &&
      !editedSkills.toLowerCase().includes(skill.toLowerCase())
    ) {
      setEditedSkills((prev) => (prev ? `${prev}, ${skill}` : skill));
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const skills = editedSkills
      .split(",")
      .filter((s) => s.trim() !== skillToRemove);
    setEditedSkills(skills.join(", "));
  };

  const currentSkills = editedSkills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader
        title="Settings"
        description="Manage your career profile, target role, and skills"
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Target Role Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Target Role</CardTitle>
            </div>
            <CardDescription>
              Your primary career focus. This drives personalized
              recommendations across the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={editedIndustry}
                onValueChange={(value) => {
                  setEditedIndustry(value);
                  setEditedRole("");
                }}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableRoles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target Role</Label>
                <Select value={editedRole} onValueChange={setEditedRole}>
                  <SelectTrigger id="targetRole">
                    <SelectValue placeholder="Select your target role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.title}>
                        {role.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing your target role will update your learning
                  recommendations and career plan.
                </p>
              </div>
            )}

            {profile?.targetRole && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Current:</span>
                <Badge variant="secondary">{profile.targetRole}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <CardTitle>Skills</CardTitle>
            </div>
            <CardDescription>
              Add or remove skills based on your interests and career goals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skills">Add Skills</Label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  placeholder="Type a skill and press Enter"
                  value={editedSkills}
                  onChange={(e) => setEditedSkills(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const input = e.currentTarget.value;
                      if (input.trim()) {
                        handleAddSkill(input.trim());
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or comma to add multiple skills
              </p>
            </div>

            {currentSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentSkills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveLoading} className="gap-2">
            {saveLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
