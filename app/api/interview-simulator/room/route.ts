import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AccessToken } from "livekit-server-sdk";

const isValidWsUrl = (value: string) => /^wss?:\/\//i.test(value);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roomName, role = "Software Engineer", level = "Mid-Level" } = body;
    const resolvedRoomName = roomName || `interview-${userId}-${Date.now()}`;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "Missing LiveKit server configuration" },
        { status: 500 }
      );
    }

    if (!isValidWsUrl(wsUrl)) {
      return NextResponse.json(
        { error: "LIVEKIT_URL must start with ws:// or wss://" },
        { status: 500 }
      );
    }

    // Use unique participant identities to prevent duplicate-identity disconnects.
    const identity = `candidate-${userId}-${Date.now()}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: `Interview Candidate (${role})`,
      ttl: "1h",
      metadata: JSON.stringify({
        role,
        level,
        type: "voice-interview",
      }),
    });
    token.addGrant({
      room: resolvedRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return NextResponse.json({
      token: await token.toJwt(),
      roomName: resolvedRoomName,
      wsUrl,
      participantIdentity: identity,
    });
  } catch (error) {
    console.error("Error creating interview room:", error);
    return NextResponse.json(
      {
        error: "Failed to create interview room",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
