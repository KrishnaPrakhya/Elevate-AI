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
        error: "Transcription handled in the browser",
        message: "Use /interview/simulator-live where browser speech recognition feeds the Ollama Cloud interview flow.",
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
