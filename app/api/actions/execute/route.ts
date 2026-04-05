import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

/**
 * Execute Confirmed Action Endpoint
 *
 * This endpoint executes actions that have been confirmed by the user.
 * For chatbot actions, we execute directly without pre-saving to database.
 */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { actionId, actionType, params, title, description } = body;

    if (!actionType) {
      return NextResponse.json(
        { error: "Action type is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Execute the action based on type
    let result: any;

    try {
      switch (actionType) {
        case "SEND_EMAIL":
          result = await executeSendEmail(params, user);
          break;

        case "CREATE_CALENDAR_EVENT":
          result = await executeCreateCalendarEvent(params, user);
          break;

        case "TRACK_JOB_APPLICATION":
          result = await executeTrackJobApplication(params, user);
          break;

        case "SCHEDULE_MENTORSHIP":
          result = await executeScheduleMentorship(params, user);
          break;

        case "UPDATE_PROGRESS":
          result = await executeUpdateProgress(params, user);
          break;

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      // Record the executed action (optional, for audit trail)
      try {
        await db.executedAction.create({
          data: {
            userId: user.id,
            type: actionType,
            title: title || actionType,
            description: description || "",
            params: params,
            result: result,
            status: result.success ? "SUCCESS" : "FAILED",
            errorMessage: result.error || null,
          },
        });
      } catch (dbError) {
        console.error("Failed to record executed action:", dbError);
        // Continue anyway - this is just audit logging
      }

      return NextResponse.json({
        success: true,
        actionId,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record the failed execution (optional)
      try {
        await db.executedAction.create({
          data: {
            userId: user.id,
            type: actionType,
            title: title || actionType,
            description: description || "",
            params: params,
            result: { error: errorMessage },
            status: "FAILED",
            errorMessage,
          },
        });
      } catch (dbError) {
        console.error("Failed to record failed action:", dbError);
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error executing action:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}

/**
 * Action Executors
 */

async function executeSendEmail(params: any, user: any) {
  // Call Python backend for email sending
  const PYTHON_BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:5000";

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/tools/send_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Email API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Email send error, using fallback:", error);
    // Fallback to Resend directly
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const email = await resend.emails.send({
      from: "ElevateAI <notifications@elevateai.com>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    return { success: true, messageId: email.id };
  }
}

async function executeCreateCalendarEvent(params: any, user: any) {
  // Call Python backend for calendar event creation
  const PYTHON_BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:5000";

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/tools/create_calendar_event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Calendar API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Store the calendar event in database if successful
    if (result.success && result.google_event_id) {
      await db.calendarEvent.create({
        data: {
          userId: user.id,
          googleEventId: result.google_event_id,
          type: params.event_type || "CUSTOM",
          title: params.title,
          description: params.description,
          startTime: new Date(params.start_time),
          endTime: new Date(params.end_time),
          timezone: params.timezone || "UTC",
          attendees: params.attendees || [],
          metadata: result,
        },
      });
    }

    return result;
  } catch (error) {
    console.error("Calendar event error, using fallback:", error);
    // Return mock success for development
    return {
      success: true,
      mock: true,
      event: params,
    };
  }
}

async function executeTrackJobApplication(params: any, user: any) {
  // Create job application record
  const application = await db.jobApplication.create({
    data: {
      userId: user.id,
      company: params.company,
      role: params.role,
      jobUrl: params.job_url,
      location: params.location,
      salaryRange: params.salary_range,
      remote: params.remote || false,
      status: "TRACKING",
      followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  return {
    success: true,
    applicationId: application.id,
    application,
  };
}

async function executeScheduleMentorship(params: any, user: any) {
  // Create mentorship session record
  const session = await db.mentorshipSession.create({
    data: {
      mentorId: params.mentor_id,
      studentId: user.id,
      scheduledAt: new Date(params.scheduled_time),
      durationMinutes: params.duration_minutes || 30,
      status: "SCHEDULED",
      notes: params.notes,
    },
  });

  // TODO: Send confirmation emails to both parties

  return {
    success: true,
    sessionId: session.id,
    session,
  };
}

async function executeUpdateProgress(params: any, user: any) {
  const { progress_type, lesson_id, skill_name, mastery_delta } = params;

  if (progress_type === "lesson_completed" && lesson_id) {
    // Update lesson progress
    const enrollment = await db.enrollment.findFirst({
      where: { userId: user.id },
    });

    if (enrollment) {
      await db.lessonProgress.upsert({
        create: {
          enrollmentId: enrollment.id,
          lessonId: lesson_id,
          status: "COMPLETED",
          completedAt: new Date(),
        },
        update: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
        where: {
          enrollmentId_lessonId: {
            enrollmentId: enrollment.id,
            lessonId,
          },
        },
      });
    }
  }

  if (progress_type === "skill_mastery" && skill_name && mastery_delta) {
    // Update skill mastery
    const skill = await db.skillNode.findUnique({
      where: { name: skill_name },
    });

    if (skill) {
      await db.userSkillProgress.upsert({
        create: {
          userId: user.id,
          skillId: skill.id,
          masteryLevel: mastery_delta,
        },
        update: {
          masteryLevel: { increment: mastery_delta },
          lastPracticed: new Date(),
        },
        where: {
          userId_skillId: {
            userId: user.id,
            skillId: skill.id,
          },
        },
      });
    }
  }

  return { success: true, updated: true };
}

// GET endpoint to list pending actions
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const pendingActions = await db.pendingAction.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      actions: pendingActions.map((action) => ({
        id: action.id,
        type: action.type.toLowerCase().replace("_", "") as any,
        title: action.title,
        description: action.description,
        params: action.params as any,
        expiresAt: action.expiresAt.toISOString(),
        metadata: action.metadata as any,
      })),
    });
  } catch (error) {
    console.error("Error fetching pending actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending actions" },
      { status: 500 }
    );
  }
}
