import OpenAI from "openai";
import { db } from "../prisma";
import { inngest } from "./client";
import { analyzeCareerProfile } from "../ai/career-agent";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

const getBackendBaseUrl = () => {
  const raw =
    process.env.FASTAPI_URL ||
    process.env.NEXT_PUBLIC_FLASK_BACKEND_URL ||
    process.env.NEXT_PUBLIC_FAST_API_BACKEND_URL_LOCAL ||
    "https://elevate-ai-flask.onrender.com";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

async function sendEmailViaBackend(input: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  text?: string;
}) {
  const response = await fetch(`${getBackendBaseUrl()}/api/tools/send_email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      from_name: input.fromName || "ElevateAI Academy",
      email_type: "general",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email backend failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    success?: boolean;
    error?: string;
  };

  if (!result.success) {
    throw new Error(result.error || "Email backend returned an unsuccessful result");
  }

  return result;
}

// ============================================
// INDUSTRY INSIGHTS CRON (existing)
// ============================================

export const getIndustryInsights = inngest.createFunction(
  { id: "AIInsights", name: "Generate industry insights" },
  { cron: "0 0 * * 0" },
  async ({ step }) => {
    const industries = await step.run("Fetch Industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });
    for (const { industry } of industries) {
      const prompt = `Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
      ],
      "growthRate": number,
      "demandLevel": "HIGH" | "MEDIUM" | "LOW",
      "topSkills": ["skill1", "skill2"],
      "marketOutLook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "keyTrends": ["trend1", "trend2"],
      "recommendedSkills": ["skill1", "skill2"]
    }
    IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
    Include at least 5 common roles for salary ranges.
    Growth rate should be a percentage.
    Include at least 5 skills and trends.`;
      const res = await step.ai.wrap("ollama", async (p) => {
        return await model.chat.completions.create({
          model: "gpt-oss:20b-cloud",
          messages: [{ role: "user", content: p }],
        });
      }, prompt);
      const text = res.choices[0]?.message?.content || "";
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      const insights = JSON.parse(cleanedText);
      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdated: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);

// ============================================
// ACADEMY EMAIL FUNCTIONS
// ============================================

// Daily Digest Email - 9 AM daily
export const sendDailyDigest = inngest.createFunction(
  { id: "daily-digest", name: "Daily Learning Digest" },
  { cron: "0 9 * * *" },
  async ({ step }) => {
    const users = await step.run("Fetch users with email preferences", async () => {
      return db.user.findMany({
        where: {
          emailPreference: {
            dailyDigest: true,
          },
        },
        include: {
          emailPreference: true,
          dailyGoals: {
            where: {
              date: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
          streak: true,
          enrollments: {
            include: { learningPath: true },
          },
        },
      });
    });

    for (const user of users) {
      const emailPref = user.emailPreference;

      if (!emailPref || !emailPref.dailyDigest) continue;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const yesterdayGoal = await step.run(`Fetch yesterday's goal for ${user.email}`, async () => {
        return db.dailyGoal.findUnique({
          where: { userId_date: { userId: user.id, date: yesterday } },
        });
      });

      const body = generateDailyDigestEmail({
        userName: user.name || user.email.split("@")[0],
        streak: user.streak?.currentStreak || 0,
        yesterdayProgress: yesterdayGoal
          ? {
              minutes: yesterdayGoal.actualMinutes,
              target: yesterdayGoal.targetMinutes,
              lessons: yesterdayGoal.lessonsCompleted,
              assignments: yesterdayGoal.assignmentsCompleted,
            }
          : undefined,
        todayRecommendation: await getAIRecommendation({ industry: user.industry, experience: user.experience, streak: user.streak || undefined }),
        activePaths: user.enrollments.slice(0, 3),
      });

      await step.run(`Send daily digest to ${user.email}`, async () => {
        await db.sentEmail.create({
          data: {
            preferenceId: emailPref.id,
            type: "DAILY_DIGEST",
            subject: `Your Daily Learning Digest - ${new Date().toLocaleDateString()}`,
            body,
            metadata: { userId: user.id },
          },
        });

        await sendEmailViaBackend({
          to: user.email,
          subject: `Your Daily Learning Digest - ${new Date().toLocaleDateString()}`,
          html: body,
          fromName: "ElevateAI Academy",
        });
      });
    }
  }
);

// Weekly Progress Report - Monday 9 AM
export const sendWeeklyProgress = inngest.createFunction(
  { id: "weekly-progress", name: "Weekly Progress Report" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const users = await step.run("Fetch users with weekly preference", async () => {
      return db.user.findMany({
        where: {
          emailPreference: { weeklyProgress: true },
        },
        include: {
          emailPreference: true,
          streak: true,
        },
      });
    });

    for (const user of users) {
      const weekStats = await step.run(`Fetch week stats for ${user.email}`, async () => {
        const [dailyGoals, lessonsCompleted, assignmentsCompleted, achievementsEarned] = await Promise.all([
          db.dailyGoal.findMany({
            where: { userId: user.id, date: { gte: startOfWeek } },
          }),
          db.lessonProgress.count({
            where: {
              enrollment: { userId: user.id },
              status: "COMPLETED",
              completedAt: { gte: startOfWeek },
            },
          }),
          db.submission.count({
            where: {
              userId: user.id,
              submittedAt: { gte: startOfWeek },
              score: { not: null },
            },
          }),
          db.userAchievement.count({
            where: {
              userId: user.id,
              earnedAt: { gte: startOfWeek },
            },
          }),
        ]);

        const totalMinutes = dailyGoals.reduce((acc, g) => acc + g.actualMinutes, 0);
        const daysActive = dailyGoals.filter((g) => g.actualMinutes > 0).length;

        return {
          totalMinutes,
          daysActive,
          lessonsCompleted,
          assignmentsCompleted,
          achievementsEarned,
        };
      });

      const emailPref = user.emailPreference;
      if (!emailPref?.weeklyProgress) continue;

      const body = generateWeeklyProgressEmail({
        userName: user.name || user.email.split("@")[0],
        weekStats,
        streak: user.streak?.currentStreak || 0,
        rank: await getUserRank(user.id),
      });

      await step.run(`Send weekly report to ${user.email}`, async () => {
        await db.sentEmail.create({
          data: {
            preferenceId: emailPref.id,
            type: "WEEKLY_PROGRESS",
            subject: `Your Week ${new Date().toLocaleDateString()} - Progress Report`,
            body,
            metadata: { userId: user.id, weekStats },
          },
        });

        await sendEmailViaBackend({
          to: user.email,
          subject: "Your Weekly Progress Report",
          html: body,
          fromName: "ElevateAI Academy",
        });
      });
    }
  }
);

// Streak Reminder - 7 PM if no activity today
export const sendStreakReminders = inngest.createFunction(
  { id: "streak-reminder", name: "Streak Reminder" },
  { cron: "0 19 * * *" },
  async ({ step }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await step.run("Fetch users with streak preferences", async () => {
      return db.user.findMany({
        where: {
          emailPreference: { streakReminders: true },
        },
        include: {
          emailPreference: true,
          streak: true,
          dailyGoals: {
            where: { date: today },
          },
        },
      });
    });

    for (const user of users) {
      const todayGoal = user.dailyGoals[0];
      const hasActivityToday = todayGoal && todayGoal.actualMinutes > 0;

      if (hasActivityToday) continue;
      if (!user.streak || user.streak.currentStreak < 3) continue;

      const emailPref = user.emailPreference;
      if (!emailPref?.streakReminders) continue;

      const motivationalMessage = getStreakReminderMessage(user.streak.currentStreak);

      const body = `
        <h1>Don't Lose Your ${user.streak.currentStreak}-Day Streak!</h1>
        <p>Hey ${user.name || user.email.split("@")[0]},</p>
        <p>You haven't logged any learning activity today. Just <strong>15 minutes</strong> of learning will keep your streak alive!</p>
        <p>${motivationalMessage}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/academy">Continue Learning</a></p>
      `;

      await step.run(`Send streak reminder to ${user.email}`, async () => {
        const streakDays = user.streak?.currentStreak || 0;
        await db.sentEmail.create({
          data: {
            preferenceId: emailPref.id,
            type: "STREAK_REMINDER",
            subject: `Don't Lose Your ${streakDays}-Day Streak!`,
            body,
            metadata: { userId: user.id, streakDays },
          },
        });

        await sendEmailViaBackend({
          to: user.email,
          subject: `Don't Lose Your ${streakDays}-Day Streak!`,
          html: body,
          fromName: "ElevateAI Academy",
        });
      });
    }
  }
);

// Deadline Alert - 24 hours before assignment due
export const sendDeadlineAlerts = inngest.createFunction(
  { id: "deadline-alert", name: "Assignment Deadline Alerts" },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const assignments = await step.run("Fetch assignments due tomorrow", async () => {
      return db.assignment.findMany({
        where: {
          dueDate: {
            gte: tomorrowStart,
            lte: tomorrow,
          },
        },
        include: {
          module: {
            include: { learningPath: true },
          },
          submissions: true,
        },
      });
    });

    for (const assignment of assignments) {
      // Find users enrolled in this path but haven't submitted
      const enrolledUsers = await step.run(`Find enrolled users for ${assignment.title}`, async () => {
        return db.enrollment.findMany({
          where: {
            learningPathId: assignment.module.learningPathId,
            progress: { lt: 100 },
          },
          include: {
            user: { include: { emailPreference: true } },
          },
        });
      });

      for (const enrollment of enrolledUsers) {
        const hasSubmitted = assignment.submissions.some(
          (s) => s.userId === enrollment.userId
        );
        if (hasSubmitted) continue;

        const emailPref = enrollment.user.emailPreference;
        if (!emailPref?.deadlineAlerts) continue;

        const body = `
          <h1>Assignment Due Tomorrow!</h1>
          <p>Hey ${enrollment.user.name || enrollment.user.email.split("@")[0]},</p>
          <p><strong>${assignment.title}</strong> in ${assignment.module.learningPath.title} is due in 24 hours!</p>
          <p>Don't forget to submit your work.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/academy/assignments/${assignment.id}">Submit Now</a></p>
        `;

        await step.run(`Send deadline alert to ${enrollment.user.email}`, async () => {
          await db.sentEmail.create({
            data: {
              preferenceId: emailPref.id,
              type: "DEADLINE_ALERT",
              subject: `Reminder: ${assignment.title} Due Tomorrow!`,
              body,
              metadata: {
                userId: enrollment.userId,
                assignmentId: assignment.id,
              },
            },
          });

          await sendEmailViaBackend({
            to: enrollment.user.email,
            subject: `Reminder: ${assignment.title} Due Tomorrow!`,
            html: body,
            fromName: "ElevateAI Academy",
          });
        });
      }
    }
  }
);

// Achievement Unlocked Email
export const sendAchievementEmails = inngest.createFunction(
  { id: "achievement-unlocked", name: "Achievement Notifications" },
  { event: "academy/achievement-unlocked" },
  async ({ event, step }) => {
    const { userId, achievementId } = event.data;

    const [user, achievement, emailPref] = await Promise.all([
      step.run("Fetch user", () =>
        db.user.findUnique({ where: { id: userId } })
      ),
      step.run("Fetch achievement", () =>
        db.achievement.findUnique({ where: { id: achievementId } })
      ),
      step.run("Fetch email preference", () =>
        db.emailPreference.findUnique({ where: { userId } })
      ),
    ]);

    if (!user || !achievement || !emailPref?.achievementAlerts) return;

    const body = `
      <h1>Achievement Unlocked! 🎉</h1>
      <p>Congratulations ${user.name || user.email.split("@")[0]}!</p>
      <p>You've earned the <strong>${achievement.title}</strong> badge!</p>
      <p>${achievement.description}</p>
      <p>+${achievement.points} points added to your account!</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/academy/achievements">View Your Achievements</a></p>
    `;

    await step.run(`Send achievement email to ${user.email}`, async () => {
      await db.sentEmail.create({
        data: {
          preferenceId: emailPref.id,
          type: "ACHIEVEMENT_UNLOCKED",
          subject: `🎉 Achievement Unlocked: ${achievement.title}`,
          body,
          metadata: { userId, achievementId },
        },
      });

      await sendEmailViaBackend({
        to: user.email,
        subject: `🎉 Achievement Unlocked: ${achievement.title}`,
        html: body,
        fromName: "ElevateAI Academy",
      });
    });
  }
);

// Inactivity Alert - 3 days no activity
export const sendInactivityAlerts = inngest.createFunction(
  { id: "inactivity-alert", name: "Inactivity Detection" },
  { cron: "0 10 * * *" },
  async ({ step }) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const users = await step.run("Fetch inactive users", async () => {
      return db.user.findMany({
        where: {
          emailPreference: { dailyDigest: true },
          OR: [
            { enrollments: { none: { lastAccessedAt: { gte: threeDaysAgo } } } },
            {
              dailyGoals: {
                none: {
                  date: { gte: threeDaysAgo },
                  actualMinutes: { gt: 0 },
                },
              },
            },
          ],
        },
        include: {
          emailPreference: true,
          streak: true,
          enrollments: {
            include: { learningPath: true },
            take: 1,
          },
        },
      });
    });

    for (const user of users) {
      const emailPref = user.emailPreference;
      if (!emailPref) continue;

      const learningPath = user.enrollments[0]?.learningPath;
      const incentiveMessage = getInactivityNudgeMessage(user.streak?.currentStreak || 0);

      const body = `
        <h1>We Miss You!</h1>
        <p>Hey ${user.name || user.email.split("@")[0]},</p>
        <p>It's been a few days since your last learning session. Your skills won't improve themselves!</p>
        ${learningPath ? `<p>Continue where you left off: <strong>${learningPath.title}</strong></p>` : ""}
        <p>${incentiveMessage}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/academy">Start Learning Again</a></p>
      `;

      await step.run(`Send inactivity alert to ${user.email}`, async () => {
        await db.sentEmail.create({
          data: {
            preferenceId: emailPref.id,
            type: "INACTIVITY_ALERT",
            subject: "We Miss You! Come Back and Keep Learning",
            body,
            metadata: { userId: user.id },
          },
        });

        await sendEmailViaBackend({
          to: user.email,
          subject: "We Miss You! Come Back and Keep Learning",
          html: body,
          fromName: "ElevateAI Academy",
        });
      });
    }
  }
);

// Leaderboard Update - Weekly
export const sendLeaderboardUpdates = inngest.createFunction(
  { id: "leaderboard-update", name: "Leaderboard Notifications" },
  { cron: "0 18 * * 0" },
  async ({ step }) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const leaderboard = await step.run("Get or create weekly leaderboard", async () => {
      let lb = await db.leaderboard.findFirst({
        where: {
          type: "WEEKLY",
          startDate: { gte: weekStart },
        },
        include: {
          entries: {
            orderBy: { rank: "asc" },
            take: 10,
          },
        },
      });

      if (!lb) {
        // Calculate rankings from lesson progress and submissions
        const userStats = await db.user.findMany({
          where: {
            enrollments: { some: {} },
          },
          include: {
            _count: {
              select: {
                userAchievements: true,
              },
            },
          },
        });

        const rankedUsers = await Promise.all(
          userStats.map(async (u) => {
            const lessons = await db.lessonProgress.count({
              where: { enrollment: { userId: u.id }, status: "COMPLETED" },
            });
            const points = u._count.userAchievements * 10 + lessons * 5;
            return { userId: u.id, points };
          })
        );

        rankedUsers.sort((a, b) => b.points - a.points);

        lb = await db.leaderboard.create({
          data: {
            type: "WEEKLY",
            period: `${weekStart.toISOString().split("T")[0]}_${now.toISOString().split("T")[0]}`,
            startDate: weekStart,
            endDate: now,
            entries: {
              create: rankedUsers.slice(0, 100).map((r, i) => ({
                userId: r.userId,
                points: r.points,
                rank: i + 1,
              })),
            },
          },
          include: {
            entries: {
              orderBy: { rank: "asc" },
              take: 10,
            },
          },
        });
      }

      return lb;
    });

    // Notify top performers
    const topUsers = leaderboard.entries.slice(0, 3);
    for (const entry of topUsers) {
      const [emailPref, user] = await step.run(`Fetch email pref and user for rank ${entry.rank}`, async () =>
        Promise.all([
          db.emailPreference.findUnique({ where: { userId: entry.userId } }),
          db.user.findUnique({ where: { id: entry.userId } }),
        ])
      );

      if (!emailPref?.leaderboardUpdates || !user) continue;

      const body = `
        <h1>🏆 Top Performer This Week!</h1>
        <p>Congratulations ${user.name || user.email.split("@")[0]}!</p>
        <p>You finished <strong>#${entry.rank}</strong> on the weekly leaderboard with <strong>${entry.points} points</strong>!</p>
        <p>Keep up the great work!</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/academy/leaderboard">View Full Rankings</a></p>
      `;

      await step.run(`Send leaderboard email to ${user.email}`, async () => {
        await db.sentEmail.create({
          data: {
            preferenceId: emailPref.id,
            type: "LEADERBOARD_UPDATE",
            subject: `🏆 You Ranked #${entry.rank} This Week!`,
            body,
            metadata: { userId: entry.userId, rank: entry.rank },
          },
        });

        await sendEmailViaBackend({
          to: user.email,
          subject: `🏆 You Ranked #${entry.rank} This Week!`,
          html: body,
          fromName: "ElevateAI Academy",
        });
      });
    }
  }
);

// ============================================
// ONBOARDING AI BACKGROUND PROCESSING
// ============================================

export const processOnboardingAI = inngest.createFunction(
  { id: "process-onboarding-ai", name: "Process Onboarding AI Analysis" },
  { event: "onboarding/ai.requested" },
  async ({ event, step }) => {
    const { industry, experience, skills, bio, targetRole, careerGoals } = event.data as {
      industry: string;
      experience: number;
      skills: string[];
      bio: string;
      targetRole?: string;
      careerGoals?: string[];
    };

    const careerInsight = await step.run("analyze-career-profile", async () => {
      return analyzeCareerProfile({
        industry,
        experience,
        skills,
        bio,
        targetRole,
        careerGoals,
      });
    });

    await step.run("update-industry-insight", async () => {
      await db.industryInsight.update({
        where: { industry },
        data: {
          topSkills: careerInsight.skillGaps.map((g) => g.skill),
          keyTrends: careerInsight.marketTrends.map((t) => t.trend),
          recommendedSkills: careerInsight.skillGaps.slice(0, 5).map((g) => g.skill),
          lastUpdated: new Date(),
          nextUpdated: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getAIRecommendation(user: { industry: string | null; experience: number | null; streak?: { currentStreak: number | null } }): Promise<string> {
  if (!model) return "Keep learning to improve your skills!";

  try {
    const prompt = `As a learning coach for a ${user.industry} professional with ${user.experience} years experience,
      who is on a ${user.streak?.currentStreak || 0}-day learning streak, suggest ONE specific thing they should learn today.
      Keep it under 20 words and make it actionable.`;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
    });
    return result.choices[0]?.message?.content?.trim() || "";
  } catch {
    return "Review your industry insights to stay updated!";
  }
}

async function getUserRank(userId: string): Promise<number> {
  const allUsers = await db.user.findMany({
    include: { _count: { select: { userAchievements: true } } },
  });

  const stats = await Promise.all(
    allUsers.map(async (u) => {
      const lessons = await db.lessonProgress.count({
        where: { enrollment: { userId: u.id }, status: "COMPLETED" },
      });
      return {
        userId: u.id,
        points: u._count.userAchievements * 10 + lessons * 5,
      };
    })
  );

  stats.sort((a, b) => b.points - a.points);
  const rank = stats.findIndex((s) => s.userId === userId) + 1;
  return rank;
}

function generateDailyDigestEmail(data: {
  userName: string;
  streak: number;
  yesterdayProgress?: { minutes: number; target: number; lessons: number; assignments: number } | null;
  todayRecommendation?: string;
  activePaths?: { learningPath: { title: string }; progress: number }[];
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4F46E5;">Good Morning, ${data.userName}! ☀️</h1>

      ${data.streak > 0 ? `<div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        🔥 You're on a <strong>${data.streak}-day streak</strong>! Keep it going!
      </div>` : ""}

      ${data.yesterdayProgress && data.yesterdayProgress.minutes !== null ? `
      <h2 style="color: #374151;">Yesterday's Progress</h2>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">
        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #4F46E5;">${data.yesterdayProgress.minutes}/${data.yesterdayProgress.target} min</div>
          <div style="color: #6B7280;">Learning Time</div>
        </div>
        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #059669;">${data.yesterdayProgress.lessons}</div>
          <div style="color: #6B7280;">Lessons</div>
        </div>
        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #7C3AED;">${data.yesterdayProgress.assignments}</div>
          <div style="color: #6B7280;">Assignments</div>
        </div>
      </div>
      ` : ""}

      ${data.todayRecommendation ? `
      <h2 style="color: #374151;">Today's Recommendation</h2>
      <p style="background: #EEF2FF; padding: 15px; border-radius: 8px; font-style: italic;">
        "${data.todayRecommendation}"
      </p>
      ` : ""}

      ${data.activePaths && data.activePaths.length > 0 ? `
      <h2 style="color: #374151;">Continue Learning</h2>
      ${data.activePaths.map((p: { learningPath: { title: string }; progress: number }) => `
        <div style="border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; margin: 10px 0;">
          <strong>${p.learningPath.title}</strong>
          <p style="color: #6B7280; margin: 5px 0;">${Math.round(p.progress)}% complete</p>
          <div style="background: #E5E7EB; height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: #4F46E5; height: 100%; width: ${p.progress}%;"></div>
          </div>
        </div>
      `).join("")}
      ` : ""}

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/academy" style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Continue Learning
        </a>
      </div>
    </div>
  `;
}

function generateWeeklyProgressEmail(data: {
  weekStats: {
    totalMinutes: number;
    daysActive: number;
    lessonsCompleted: number;
    assignmentsCompleted: number;
    achievementsEarned: number;
  };
  userName: string;
  streak: number;
  rank: number;
}): string {
  const { weekStats, userName, streak, rank } = data;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4F46E5;">Your Week in Review 📊</h1>
      <p>Hello ${userName},</p>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: bold; color: #4F46E5;">${weekStats.totalMinutes}</div>
          <div style="color: #6B7280;">Minutes Learned</div>
        </div>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: bold; color: #059669;">${weekStats.daysActive}</div>
          <div style="color: #6B7280;">Days Active</div>
        </div>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: bold; color: #7C3AED;">${weekStats.lessonsCompleted}</div>
          <div style="color: #6B7280;">Lessons Completed</div>
        </div>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 32px; font-weight: bold; color: #DC2626;">${weekStats.assignmentsCompleted}</div>
          <div style="color: #6B7280;">Assignments Graded</div>
        </div>
      </div>

      ${weekStats.achievementsEarned > 0 ? `
      <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; text-align: center;">
        🎉 You earned <strong>${weekStats.achievementsEarned} achievement${weekStats.achievementsEarned > 1 ? "s" : ""}</strong> this week!
      </div>
      ` : ""}

      <div style="background: #EEF2FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Your Stats</h3>
        <p style="margin: 5px 0;">🔥 Current Streak: <strong>${streak} days</strong></p>
        <p style="margin: 5px 0;">🏆 Leaderboard Rank: <strong>#${rank}</strong></p>
      </div>

      <p style="text-align: center; color: #6B7280; margin-top: 30px;">
        Keep up the great work! See you next week! 👋
      </p>

      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/academy" style="background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Dashboard
        </a>
      </div>
    </div>
  `;
}

function getStreakReminderMessage(streakDays: number): string {
  if (streakDays >= 30) return "You're a learning machine! 💪 Just 15 more minutes to keep your streak alive!";
  if (streakDays >= 14) return "Two weeks strong! 🌟 Your consistency is inspiring!";
  if (streakDays >= 7) return "One week down! 🎯 Keep the momentum going!";
  return "Every day counts! 📈 15 minutes is all you need!";
}

function getInactivityNudgeMessage(streakDays: number): string {
  if (streakDays > 0) return `Don't let your ${streakDays}-day streak go to waste!`;
  return "Every expert was once a beginner. Start today!";
}