import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "Transcription handled in the browser",
        message: "Use the built-in speech recognition instead of this endpoint.",
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("Error transcribing audio:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to transcribe audio", details: errorMessage },
      { status: 500 }
    );
  }
}
