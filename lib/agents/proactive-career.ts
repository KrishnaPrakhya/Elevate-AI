/**
 * Proactive Career Agent for ElevateAI

 * This agent monitors user progress and triggers interventions:
 * - Milestone celebrations (7-day streaks, course completions)
 * - Re-engagement nudges (3+ days inactive)
 * - Job search suggestions (resume complete but not searching)
 * - Skill gap alerts
 * - Interview preparation reminders

 * The agent runs periodically via Inngest cron jobs.
 */

import { db } from "../prisma";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : undefined;

interface UserIntervention {
  type: InterventionType;
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  action?: {
    type: "email" | "calendar" | "notification";
    params: Record<string, any>;
  };
}

type InterventionType =
  | "celebrate_milestone"
  | "re_engagement"
  | "suggest_job_search"
  | "skill_gap_alert"
  | "interview_reminder"
  | "learning_path_suggestion"
  | "streak_nudge";

/**
 * Check all users for intervention opportunities
 */
export async function checkCareerInterventions() {
  const users = await db.user.findMany({
    include: {
      streak: true,
      enrollments: {
        include: {
          learningPath: true,
          lessonProgress: true,
        },
      },
      skillProgress: {
        include: {
          skill: true,
        },
      },
      resume: true,
      jobApplications: true,
      emailPreference: true,
    },
  });

  const interventions: Array<{ userId: string; intervention: UserIntervention }> = [];

  for (const user of users) {
    const userInterventions = await analyzeUserForInterventions(user);
    for (const intervention of userInterventions) {
      interventions.push({ userId: user.id, intervention });
    }
  }

  // Execute interventions
  for (const { userId, intervention } of interventions) {
    await executeIntervention(userId, intervention);
  }

  return { interventions: interventions.length };
}

/**
 * Analyze a single user for intervention opportunities
 */
async function analyzeUserForInterventions(user: any): Promise<UserIntervention[]> {
  const interventions: UserIntervention[] = [];

  // Check for milestone celebrations
  if (user.streak) {
    const { currentStreak } = user.streak;

    // Celebrate 7-day, 30-day milestones
    if (currentStreak > 0 && currentStreak % 7 === 0) {
      interventions.push({
        type: "celebrate_milestone",
        priority: "high",
        title: "🎉 Learning Milestone Achieved!",
        message: `You've maintained a ${currentStreak}-day learning streak! Keep up the amazing work!`,
        action: {
          type: "email",
          params: {
            email_type: "achievement",
            achievement_title: `${currentStreak}-Day Streak Master`,
            achievement_description: `You've learned for ${currentStreak} consecutive days!`,
            points_earned: currentStreak * 10,
          },
        },
      });
    }

    // Nudge if streak is about to break (haven't been active today)
    const lastActivity = user.streak.lastActivityDate;
    const hoursSinceActivity = lastActivity
      ? (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60)
      : Infinity;

    if (hoursSinceActivity > 20 && currentStreak > 3) {
      interventions.push({
        type: "streak_nudge",
        priority: "high",
        title: "⚠️ Your Streak is at Risk!",
        message: `Don't let your ${currentStreak}-day streak go to waste! Complete a quick lesson today to keep it going.`,
        action: {
          type: "notification",
          params: {
            title: "Streak Alert",
            body: `Your ${currentStreak}-day streak needs attention!`,
          },
        },
      });
    }
  }

  // Check for re-engagement (inactive users)
  const lastEnrollment = user.enrollments[0]?.lastAccessedAt;
  const daysSinceActivity = lastEnrollment
    ? (Date.now() - new Date(lastEnrollment).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (daysSinceActivity > 3 && daysSinceActivity < 30 && user.enrollments.length > 0) {
    interventions.push({
      type: "re_engagement",
      priority: "medium",
      title: "We Miss You! 👋",
      message: `It's been ${Math.floor(daysSinceActivity)} days since your last learning session. Your next lesson is waiting!`,
      action: {
        type: "email",
        params: {
          subject: `Come back to ${user.enrollments[0]?.learningPath.title}`,
          html: generateReEngagementEmail(user, daysSinceActivity),
        },
      },
    });
  }

  // Check for job search suggestions (resume complete but no applications)
  if (user.resume?.content && (!user.jobApplications || user.jobApplications.length === 0)) {
    interventions.push({
      type: "suggest_job_search",
      priority: "medium",
      title: "Ready to Start Your Job Search? 🚀",
      message: "Your resume is ready! Let me help you find relevant job opportunities and track your applications.",
      action: {
        type: "notification",
        params: {
          title: "Start Your Job Search",
          body: "Your resume is ready. Start applying to jobs now!",
        },
      },
    });
  }

  // Check for skill gaps (learning path with slow progress)
  for (const enrollment of user.enrollments) {
    if (enrollment.progress < 20 && enrollment.enrolledAt) {
      const daysEnrolled = (Date.now() - new Date(enrollment.enrolledAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysEnrolled > 14) {
        interventions.push({
          type: "learning_path_suggestion",
          priority: "low",
          title: "Need Help with Your Learning Path?",
          message: `You're ${Math.floor(daysEnrolled)} days into ${enrollment.learningPath.title} but only ${Math.round(enrollment.progress)}% complete. Want to adjust your study plan?`,
          action: {
            type: "notification",
            params: {
              title: "Learning Path Check-in",
              body: `How's ${enrollment.learningPath.title} going?`,
            },
          },
        });
      }
    }
  }

  // Check for interview preparation reminders (job applications without interview prep)
  const hasInterviewing = user.jobApplications?.some((app: any) => app.status === "INTERVIEWING");
  if (hasInterviewing) {
    interventions.push({
      type: "interview_reminder",
      priority: "high",
      title: "🎯 Interview Preparation Time!",
      message: "You have upcoming interviews! Let's practice with mock interview questions tailored to your role.",
      action: {
        type: "calendar",
        params: {
          title: "Mock Interview Practice Session",
          event_type: "interview",
          duration_minutes: 30,
        },
      },
    });
  }

  return interventions;
}

/**
 * Execute a single intervention
 */
async function executeIntervention(userId: string, intervention: UserIntervention) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.email) return;

  // Check user's email preferences
  const emailPref = user.emailPreference;
  if (intervention.action?.type === "email" && emailPref) {
    // Respect email preferences
    if (intervention.priority === "low" && !emailPref.leaderboardUpdates) return;
  }

  // Create notification record
  await db.reminder.create({
    data: {
      userId,
      type: intervention.type.toUpperCase() as any,
      title: intervention.title,
      message: intervention.message,
      scheduledFor: new Date(),
      status: "PENDING",
      priority: intervention.priority.toUpperCase() as any,
      metadata: intervention.action?.params || {},
    },
  });

  // Execute action if specified
  if (intervention.action) {
    switch (intervention.action.type) {
      case "email":
        await sendInterventionEmail(user.email, intervention);
        break;
      case "calendar":
        // Would create calendar event via action system
        await createPendingAction(userId, "CREATE_CALENDAR_EVENT", intervention.action.params);
        break;
      case "notification":
        // In-app notification would be created here
        break;
    }
  }
}

/**
 * Send intervention email
 */
async function sendInterventionEmail(email: string, intervention: UserIntervention) {
  if (!resend) {
    console.log(`[MOCK EMAIL] ${email}: ${intervention.title}`);
    return;
  }

  const html = `
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2563eb;">${intervention.title}</h2>
      <p>${intervention.message}</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">Ready to take action?</p>
        <a href="https://elevateai.com/dashboard"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Go to Dashboard
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        Best regards,<br>The ElevateAI Team
      </p>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "ElevateAI <notifications@elevateai.com>",
    to: email,
    subject: intervention.title,
    html,
  });
}

/**
 * Create a pending action for user confirmation
 */
async function createPendingAction(
  userId: string,
  type: string,
  params: Record<string, any>
) {
  await db.pendingAction.create({
    data: {
      userId,
      type: type as any,
      title: `Suggested: ${type.replace("_", " ")}`,
      description: "This action was suggested by your AI Career Coach",
      params,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });
}

/**
 * Generate re-engagement email HTML
 */
function generateReEngagementEmail(user: any, daysSinceActivity: number) {
  const learningPath = user.enrollments[0]?.learningPath;

  return `
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2563eb;">We Miss You, ${user.name || "there"}! 👋</h2>

      <p>It's been <strong>${Math.floor(daysSinceActivity)} days</strong> since your last learning session.</p>

      ${learningPath ? `
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Current Learning Path</h3>
          <p style="font-size: 1.1em; font-weight: 600;">${learningPath.title}</p>
          <p style="color: #666;">${learningPath.description?.substring(0, 150)}...</p>
        </div>
      ` : ""}

      <p>Here's what you're missing:</p>
      <ul>
        <li>Daily streak bonuses</li>
        <li>New industry insights tailored to ${user.industry || "your field"}</li>
        <li>Progress toward your learning goals</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://elevateai.com/dashboard"
           style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Continue Learning
        </a>
      </div>

      <p style="color: #666; font-size: 14px;">
        Remember: Even 10 minutes a day keeps the skills sharp! 📚
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        Best regards,<br>The ElevateAI Team
      </p>
    </body>
    </html>
  `;
}

/**
 * Inngest function for running career interventions
 * This would be imported and used in lib/inngest/functions.ts
 */
export const runCareerInterventions = async () => {
  const result = await checkCareerInterventions();
  console.log(`Career interventions executed: ${result.interventions} interventions processed`);
  return result;
};
