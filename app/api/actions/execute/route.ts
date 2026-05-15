import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type ExecutedActionType =
  | "SEND_EMAIL"
  | "CREATE_CALENDAR_EVENT"
  | "SCHEDULE_MENTORSHIP"
  | "TRACK_JOB_APPLICATION"
  | "SEND_NOTIFICATION"
  | "UPDATE_PROGRESS"
  | "GENERATE_DOCUMENT";

type CalendarEventTypeValue =
  | "STUDY_SESSION"
  | "INTERVIEW"
  | "MENTORSHIP"
  | "DEADLINE"
  | "ASSESSMENT"
  | "LIVE_SESSION"
  | "CUSTOM";

type UserRef = { id: string };
type ActionParams = Record<string, unknown>;
type ActionResult = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

const getStringParam = (params: ActionParams, key: string): string | undefined => {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const getBooleanParam = (params: ActionParams, key: string): boolean | undefined => {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
};

const getNumberParam = (params: ActionParams, key: string): number | undefined => {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const getStringArrayParam = (params: ActionParams, key: string): string[] => {
  const value = params[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeActionType = (rawActionType: unknown): ExecutedActionType | null => {
  if (typeof rawActionType !== "string") return null;

  const normalized = rawActionType.trim();
  const upper = normalized.toUpperCase();

  const directEnumValues: ExecutedActionType[] = [
    "SEND_EMAIL",
    "CREATE_CALENDAR_EVENT",
    "SCHEDULE_MENTORSHIP",
    "TRACK_JOB_APPLICATION",
    "SEND_NOTIFICATION",
    "UPDATE_PROGRESS",
    "GENERATE_DOCUMENT",
  ];

  if (directEnumValues.includes(upper as ExecutedActionType)) {
    return upper as ExecutedActionType;
  }

  const aliasMap: Record<string, ExecutedActionType> = {
    email: "SEND_EMAIL",
    send_email: "SEND_EMAIL",
    calendar: "CREATE_CALENDAR_EVENT",
    create_calendar_event: "CREATE_CALENDAR_EVENT",
    mentorship: "SCHEDULE_MENTORSHIP",
    schedule_mentorship: "SCHEDULE_MENTORSHIP",
    job_application: "TRACK_JOB_APPLICATION",
    track_job_application: "TRACK_JOB_APPLICATION",
    notification: "SEND_NOTIFICATION",
    send_notification: "SEND_NOTIFICATION",
    schedule: "UPDATE_PROGRESS",
    update_progress: "UPDATE_PROGRESS",
    document: "GENERATE_DOCUMENT",
    generate_document: "GENERATE_DOCUMENT",
  };

  return aliasMap[normalized.toLowerCase()] || null;
};

const normalizeCalendarEventType = (
  rawEventType: unknown,
): CalendarEventTypeValue => {
  if (typeof rawEventType !== "string") return "CUSTOM";

  const normalized = rawEventType.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const directEnumValues: CalendarEventTypeValue[] = [
    "STUDY_SESSION",
    "INTERVIEW",
    "MENTORSHIP",
    "DEADLINE",
    "ASSESSMENT",
    "LIVE_SESSION",
    "CUSTOM",
  ];

  if (directEnumValues.includes(normalized as CalendarEventTypeValue)) {
    return normalized as CalendarEventTypeValue;
  }

  const aliasMap: Record<string, CalendarEventTypeValue> = {
    STUDY: "STUDY_SESSION",
    STUDYSESSION: "STUDY_SESSION",
    SESSION: "STUDY_SESSION",
    MOCK_INTERVIEW: "INTERVIEW",
    INTERVIEW_PREP: "INTERVIEW",
    MENTOR: "MENTORSHIP",
    MENTOR_SESSION: "MENTORSHIP",
    DUE: "DEADLINE",
    EXAM: "ASSESSMENT",
    TEST: "ASSESSMENT",
    LIVE: "LIVE_SESSION",
    DEFAULT: "CUSTOM",
    EVENT: "CUSTOM",
  };

  return aliasMap[normalized] || "CUSTOM";
};

const toPrismaJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;

const isPrismaConnectivityError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === "P1001") return true;

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes("Can't reach database server");
};

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
    const {
      actionId,
      actionType,
      params: rawParams,
      title,
      description,
    } = body as {
      actionId?: string;
      actionType?: string;
      params?: unknown;
      title?: string;
      description?: string;
    };

    const params: ActionParams =
      rawParams && typeof rawParams === "object" ? (rawParams as ActionParams) : {};

    const normalizedActionType = normalizeActionType(actionType);

    if (!actionType) {
      return NextResponse.json(
        { error: "Action type is required" },
        { status: 400 }
      );
    }

    if (!normalizedActionType) {
      return NextResponse.json(
        { error: `Unsupported action type: ${String(actionType)}` },
        { status: 400 }
      );
    }

    const canRunWithoutUserRecord = normalizedActionType === "SEND_EMAIL";

    let user: UserRef | null = null;
    let dbUnavailable = false;

    try {
      user = await db.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true },
      });
    } catch (error) {
      if (isPrismaConnectivityError(error)) {
        dbUnavailable = true;
      } else {
        throw error;
      }
    }

    if (dbUnavailable && !canRunWithoutUserRecord) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database is temporarily unavailable. Please try again in a moment.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (!user && !dbUnavailable && !canRunWithoutUserRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Execute the action based on type
    let result: ActionResult;

    try {
      switch (normalizedActionType) {
        case "SEND_EMAIL":
          result = await executeSendEmail(params);
          break;

        case "CREATE_CALENDAR_EVENT":
          if (!user) {
            throw new Error("User record is required for calendar actions");
          }
          result = await executeCreateCalendarEvent(params, user);
          break;

        case "TRACK_JOB_APPLICATION":
          if (!user) {
            throw new Error("User record is required for job application actions");
          }
          result = await executeTrackJobApplication(params, user);
          break;

        case "SCHEDULE_MENTORSHIP":
          if (!user) {
            throw new Error("User record is required for mentorship actions");
          }
          result = await executeScheduleMentorship(params, user);
          break;

        case "UPDATE_PROGRESS":
          if (!user) {
            throw new Error("User record is required for progress update actions");
          }
          result = await executeUpdateProgress(params, user);
          break;

        default:
          throw new Error(`Unknown action type: ${normalizedActionType}`);
      }

      if (result && typeof result === "object" && "success" in result && result.success === false) {
        const failureMessage =
          (result as { error?: string }).error ||
          `Action execution failed for ${normalizedActionType}`;
        throw new Error(failureMessage);
      }

      // Record the executed action (optional, for audit trail)
      if (user?.id) {
        try {
          await db.executedAction.create({
            data: {
              userId: user.id,
              type: normalizedActionType,
              title: title || normalizedActionType,
              description: description || "",
              params: toPrismaJsonValue(params),
              result: toPrismaJsonValue(result),
              status: result.success ? "SUCCESS" : "FAILED",
              errorMessage: result.error || null,
            },
          });
        } catch (dbError) {
          console.error("Failed to record executed action:", dbError);
          // Continue anyway - this is just audit logging
        }
      }

      return NextResponse.json({
        success: true,
        actionId,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record the failed execution (optional)
      if (user?.id) {
        try {
          await db.executedAction.create({
            data: {
              userId: user.id,
              type: normalizedActionType,
              title: title || normalizedActionType,
              description: description || "",
              params: toPrismaJsonValue(params),
              result: toPrismaJsonValue({ error: errorMessage }),
              status: "FAILED",
              errorMessage,
            },
          });
        } catch (dbError) {
          console.error("Failed to record failed action:", dbError);
        }
      }

      if (isPrismaConnectivityError(error)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Database is temporarily unavailable. Please try again in a moment.",
            code: "DB_UNAVAILABLE",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error executing action:", error);

    if (isPrismaConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: "Database is temporarily unavailable. Please try again in a moment.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}

/**
 * Action Executors
 */

async function executeSendEmail(params: ActionParams): Promise<ActionResult> {
  // Call Python backend for email sending
  const PYTHON_BACKEND_URL =
    process.env.FASTAPI_URL || "https://elevate-ai-flask.onrender.com";

  const to = getStringParam(params, "to");
  const subject = getStringParam(params, "subject");
  const html = getStringParam(params, "html");

  if (!to || !subject || !html) {
    throw new Error("Email action requires 'to', 'subject', and 'html' fields.");
  }

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
    console.error("Email send error via backend:", error);
    throw error instanceof Error
      ? error
      : new Error("Email send failed via backend endpoint");
  }
}

async function executeCreateCalendarEvent(
  params: ActionParams,
  user: UserRef,
): Promise<ActionResult> {
  // Call Python backend for calendar event creation
  const PYTHON_BACKEND_URL =
    process.env.FASTAPI_URL || "https://elevate-ai-flask.onrender.com";

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

    const result = (await response.json()) as ActionResult;

    const title = getStringParam(params, "title");
    const startTimeRaw = getStringParam(params, "start_time");
    const endTimeRaw = getStringParam(params, "end_time");
    const description = getStringParam(params, "description");
    const timezone = getStringParam(params, "timezone") || "UTC";
    const attendees = getStringArrayParam(params, "attendees");

    // Store the calendar event in database if successful
    if (result.success && typeof result.google_event_id === "string" && title && startTimeRaw && endTimeRaw) {
      const normalizedCalendarEventType = normalizeCalendarEventType(
        params.event_type ?? params.eventType,
      );

      await db.calendarEvent.create({
        data: {
          userId: user.id,
          googleEventId: result.google_event_id,
          type: normalizedCalendarEventType,
          title,
          description,
          startTime: new Date(startTimeRaw),
          endTime: new Date(endTimeRaw),
          timezone,
          attendees,
          metadata: toPrismaJsonValue(result),
        },
      });
    }

    return result;
  } catch (error) {
    console.error("Calendar event error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create calendar event",
      event: params,
    };
  }
}

async function executeTrackJobApplication(
  params: ActionParams,
  user: UserRef,
): Promise<ActionResult> {
  const company = getStringParam(params, "company");
  const role = getStringParam(params, "role");
  const jobUrl = getStringParam(params, "job_url");
  const location = getStringParam(params, "location");
  const salaryRange = getStringParam(params, "salary_range");
  const remote = getBooleanParam(params, "remote") || false;

  if (!company || !role || !jobUrl) {
    throw new Error("Job application action requires 'company', 'role', and 'job_url'.");
  }

  // Create job application record
  const application = await db.jobApplication.create({
    data: {
      userId: user.id,
      company,
      role,
      jobUrl,
      location,
      salaryRange,
      remote,
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

async function executeScheduleMentorship(
  params: ActionParams,
  user: UserRef,
): Promise<ActionResult> {
  const mentorId = getStringParam(params, "mentor_id");
  const scheduledTime = getStringParam(params, "scheduled_time");
  const durationMinutes = getNumberParam(params, "duration_minutes") || 30;
  const notes = getStringParam(params, "notes");

  if (!mentorId || !scheduledTime) {
    throw new Error("Mentorship action requires 'mentor_id' and 'scheduled_time'.");
  }

  // Create mentorship session record
  const session = await db.mentorshipSession.create({
    data: {
      mentorId,
      studentId: user.id,
      scheduledAt: new Date(scheduledTime),
      durationMinutes,
      status: "SCHEDULED",
      notes,
    },
  });

  // TODO: Send confirmation emails to both parties

  return {
    success: true,
    sessionId: session.id,
    session,
  };
}

async function executeUpdateProgress(
  params: ActionParams,
  user: UserRef,
): Promise<ActionResult> {
  const progressType = getStringParam(params, "progress_type");
  const lessonId = getStringParam(params, "lesson_id");
  const skillName = getStringParam(params, "skill_name");
  const masteryDelta = getNumberParam(params, "mastery_delta");

  if (progressType === "lesson_completed" && lessonId) {
    // Update lesson progress
    const enrollment = await db.enrollment.findFirst({
      where: { userId: user.id },
    });

    if (enrollment) {
      await db.lessonProgress.upsert({
        create: {
          enrollmentId: enrollment.id,
          lessonId,
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

  if (progressType === "skill_mastery" && skillName && typeof masteryDelta === "number") {
    // Update skill mastery
    const skill = await db.skillNode.findUnique({
      where: { name: skillName },
    });

    if (skill) {
      await db.userSkillProgress.upsert({
        create: {
          userId: user.id,
          skillId: skill.id,
          masteryLevel: masteryDelta,
        },
        update: {
          masteryLevel: { increment: masteryDelta },
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
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user;
    try {
      user = await db.user.findUnique({
        where: { clerkUserId: userId },
      });
    } catch (error) {
      if (isPrismaConnectivityError(error)) {
        return NextResponse.json(
          {
            error:
              "Database is temporarily unavailable. Please try again in a moment.",
            code: "DB_UNAVAILABLE",
          },
          { status: 503 },
        );
      }
      throw error;
    }

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
        type: action.type.toLowerCase().replace("_", ""),
        title: action.title,
        description: action.description,
        params: (action.params ?? {}) as Record<string, unknown>,
        expiresAt: action.expiresAt.toISOString(),
        metadata: (action.metadata ?? {}) as Record<string, unknown>,
      })),
    });
  } catch (error) {
    console.error("Error fetching pending actions:", error);

    if (isPrismaConnectivityError(error)) {
      return NextResponse.json(
        {
          error: "Database is temporarily unavailable. Please try again in a moment.",
          code: "DB_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch pending actions" },
      { status: 500 }
    );
  }
}
