import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const getBackendBaseUrl = () => {
  const raw =
    process.env.FASTAPI_URL ||
    process.env.PYTHON_BACKEND_URL ||
    process.env.NEXT_PUBLIC_FLASK_BACKEND_URL ||
    "https://elevate-ai-flask.onrender.com";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

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

    const response = await fetch(`${getBackendBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        clerkUserId,
        timezone,
        timezoneOffsetMinutes,
      }),
      cache: "no-store",
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
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
