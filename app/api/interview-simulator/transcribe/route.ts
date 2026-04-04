import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;
    const questionId = formData.get("questionId") as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert blob to base64 for API call
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Use Whisper or similar for transcription
    // For now, return a placeholder - in production, integrate with Whisper API
    const response = NextResponse.json({
      transcript: "[Transcription service not configured] This is a placeholder. In production, integrate with OpenAI Whisper or similar speech-to-text API.",
    });

    // TODO: Implement actual transcription with Whisper API
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const transcription = await openai.audio.transcriptions.create({
    //   file: new File([audioFile], "audio.wav", { type: "audio/wav" }),
    //   model: "whisper-1",
    // });
    // return NextResponse.json({ transcript: transcription.text });

    return response;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
