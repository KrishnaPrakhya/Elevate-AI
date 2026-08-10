import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getInternalBackendHeaders,
  getPythonBackendUrl,
} from "@/lib/python-backend";

/**
 * Starts Google OAuth from a Clerk-authenticated server route.
 *
 * Do not send a Clerk user ID from the browser straight to FastAPI: a caller
 * could otherwise try to attach their Google account to somebody else's ID.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const nextUrl = new URL("/profile", request.url);
  nextUrl.searchParams.set("google_calendar", "connected");

  const backendUrl = new URL(`${getPythonBackendUrl()}/api/google/connect`);
  backendUrl.searchParams.set("clerk_user_id", userId);
  backendUrl.searchParams.set("next_url", nextUrl.toString());
  backendUrl.searchParams.set("auto_redirect", "false");

  try {
    const response = await fetch(backendUrl, {
      headers: getInternalBackendHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json()) as { auth_url?: string; detail?: string };
    if (!response.ok || !payload.auth_url) {
      console.error("Unable to start Google OAuth", payload);
      return NextResponse.redirect(
        new URL("/profile?google_calendar=failed", request.url),
      );
    }

    return NextResponse.redirect(payload.auth_url);
  } catch (error) {
    console.error("Google OAuth connect proxy failed", error);
    return NextResponse.redirect(
      new URL("/profile?google_calendar=failed", request.url),
    );
  }
}
