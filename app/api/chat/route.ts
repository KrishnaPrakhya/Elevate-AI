import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getInternalBackendHeaders,
  getPythonBackendUrl,
} from "@/lib/python-backend";

export const maxDuration = 60;

const getBackendBaseUrl = () => {
  return getPythonBackendUrl();
};

function getConversationalReply(message: string): string | null {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(thanks|thank you|thank you so much|thx)$/.test(normalized)) {
    return "You’re welcome! What would you like to work on next?";
  }
  if (/^(how are you|how's it going|hows it going|what's up|whats up)$/.test(normalized)) {
    return "I’m doing well and ready to help. What are you working on today?";
  }
  if (/^(hi|hello|hey|hey there|hi there|yo|good morning|good afternoon|good evening)$/.test(normalized)) {
    return "Hey! 👋 What would you like help with today?";
  }
  if (/^(who are you|what can you do|help)$/.test(normalized)) {
    return "I’m your AI Career Advisor. I can help with job searches, resumes, interviews, learning plans, and professional emails—what should we tackle?";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const conversationalReply = getConversationalReply(message);
    if (conversationalReply) {
      return NextResponse.json({
        response: conversationalReply,
        intent: "greeting",
        pending_actions: [],
      });
    }

    const clerkUserId =
      typeof body?.clerkUserId === "string" && body.clerkUserId.trim()
        ? body.clerkUserId
        : userId;

    const timezone =
      typeof body?.timezone === "string" && body.timezone.trim()
        ? body.timezone
        : "UTC";

    const timezoneOffsetMinutes =
      typeof body?.timezoneOffsetMinutes === "number"
        ? body.timezoneOffsetMinutes
        : null;

    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (!internalSecret) {
      console.error("/api/chat proxy: INTERNAL_API_SECRET is not set");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const response = await fetch(`${getBackendBaseUrl()}/api/chat`, {
      method: "POST",
      headers: getInternalBackendHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        message,
        clerkUserId,
        timezone,
        timezoneOffsetMinutes,
      }),
      cache: "no-store",
      // Allow for Render cold starts but cap below the 60s function limit.
      signal: AbortSignal.timeout(55000),
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Backend chat request failed",
          details: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("/api/chat proxy error:", error);
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "The assistant is taking longer than expected (the backend may be waking up). Please try again."
          : "Failed to process chat request",
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
