"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/actions/user";
import { Loader2, Save, Mail, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface EmailPreferences {
  dailyDigest: boolean;
  weeklyProgress: boolean;
  streakReminders: boolean;
  deadlineAlerts: boolean;
  achievementAlerts: boolean;
  cohortMessages: boolean;
  mentorUpdates: boolean;
  leaderboardUpdates: boolean;
  emailTime: string;
  timezone: string;
}

export default function AcademySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    dailyDigest: true,
    weeklyProgress: true,
    streakReminders: true,
    deadlineAlerts: true,
    achievementAlerts: true,
    cohortMessages: true,
    mentorUpdates: true,
    leaderboardUpdates: false,
    emailTime: "09:00",
    timezone: "UTC",
  });

  useEffect(() => {
    async function load() {
      try {
        const user = await getUser();
        if (user.emailPreference) {
          setPreferences({
            dailyDigest: user.emailPreference.dailyDigest,
            weeklyProgress: user.emailPreference.weeklyProgress,
            streakReminders: user.emailPreference.streakReminders,
            deadlineAlerts: user.emailPreference.deadlineAlerts,
            achievementAlerts: user.emailPreference.achievementAlerts,
            cohortMessages: user.emailPreference.cohortMessages,
            mentorUpdates: user.emailPreference.mentorUpdates,
            leaderboardUpdates: user.emailPreference.leaderboardUpdates,
            emailTime: user.emailPreference.emailTime,
            timezone: user.emailPreference.timezone,
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real app, this would call an action to update preferences
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Academy Settings</h1>
        <p className="text-muted-foreground">Manage your learning preferences and notifications</p>
      </div>

      {/* Email Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Daily Learning Digest</p>
                <p className="text-sm text-muted-foreground">Get a personalized summary every morning</p>
              </div>
              <Switch
                checked={preferences.dailyDigest}
                onCheckedChange={() => handleToggle("dailyDigest")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Weekly Progress Report</p>
                <p className="text-sm text-muted-foreground">Monday summary of your learning progress</p>
              </div>
              <Switch
                checked={preferences.weeklyProgress}
                onCheckedChange={() => handleToggle("weeklyProgress")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Streak Reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded if you haven&apos;t learned today</p>
              </div>
              <Switch
                checked={preferences.streakReminders}
                onCheckedChange={() => handleToggle("streakReminders")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Deadline Alerts</p>
                <p className="text-sm text-muted-foreground">24-hour warning before assignments are due</p>
              </div>
              <Switch
                checked={preferences.deadlineAlerts}
                onCheckedChange={() => handleToggle("deadlineAlerts")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Achievement Notifications</p>
                <p className="text-sm text-muted-foreground">Celebrate when you earn badges</p>
              </div>
              <Switch
                checked={preferences.achievementAlerts}
                onCheckedChange={() => handleToggle("achievementAlerts")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Cohort Messages</p>
                <p className="text-sm text-muted-foreground">Updates from your learning cohort</p>
              </div>
              <Switch
                checked={preferences.cohortMessages}
                onCheckedChange={() => handleToggle("cohortMessages")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Mentor Updates</p>
                <p className="text-sm text-muted-foreground">Notifications from your mentor</p>
              </div>
              <Switch
                checked={preferences.mentorUpdates}
                onCheckedChange={() => handleToggle("mentorUpdates")}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div>
                <p className="font-medium">Leaderboard Updates</p>
                <p className="text-sm text-muted-foreground">Weekly rankings notifications</p>
              </div>
              <Switch
                checked={preferences.leaderboardUpdates}
                onCheckedChange={() => handleToggle("leaderboardUpdates")}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="emailTime" className="text-sm">Email Time</Label>
            </div>
            <Input
              id="emailTime"
              type="time"
              value={preferences.emailTime}
              onChange={(e) => setPreferences((prev) => ({ ...prev, emailTime: e.target.value }))}
              className="w-32"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}