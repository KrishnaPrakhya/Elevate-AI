import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

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

    const artifacts = await db.portfolioArtifact.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error("Error loading portfolio:", error);
    return NextResponse.json(
      { error: "Failed to load portfolio" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, contentUrl, skillsDemonstrated, isPublic } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const artifact = await db.portfolioArtifact.create({
      data: {
        userId: user.id,
        title,
        description,
        contentUrl: contentUrl || null,
        skillsDemonstrated: skillsDemonstrated || [],
        isPublic: isPublic ?? true,
      },
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error("Error creating artifact:", error);
    return NextResponse.json(
      { error: "Failed to create artifact" },
      { status: 500 }
    );
  }
}
