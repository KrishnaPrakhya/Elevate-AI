import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "LiveKit voice rooms have been replaced",
        message: "Use /interview/simulator-live (browser voice + Ollama Cloud adaptive interview).",
      },
      { status: 410 }
    );
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
