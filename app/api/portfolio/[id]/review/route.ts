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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        resume: true,
        skillProgress: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const artifact = await db.portfolioArtifact.findUnique({
      where: { id, userId: user.id },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // Generate AI review
    const prompt = `
      Review the following portfolio artifact and provide detailed feedback.

      User's Industry: ${user.industry || "General"}
      User's Experience: ${user.experience || 0} years

      Artifact Details:
      Title: ${artifact.title}
      Description: ${artifact.description}
      Content URL: ${artifact.contentUrl || "Not provided"}
      Skills Demonstrated: ${artifact.skillsDemonstrated.join(", ")}

      User's Current Skills: ${user.skillProgress.map((sp) => sp.skill.name).join(", ")}

      Provide a comprehensive review including:
      1. Overall quality assessment (score 0-100)
      2. Detailed feedback on the project description and presentation
      3. How well it demonstrates the claimed skills
      4. Suggestions for improvement to make it more impressive to recruiters
      5. Any missing elements that would strengthen the portfolio

      Return ONLY a JSON object in this format (no markdown):
      {
        "score": number (0-100),
        "feedback": "2-3 paragraph detailed feedback",
        "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]
      }

      Consider:
      - Clarity and specificity of the description
      - Relevance to the user's career goals
      - Demonstration of technical skills
      - Evidence of impact and results
      - Professional presentation
    `;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    let reviewText = result.choices[0]?.message?.content?.trim() || "";

    // Clean up markdown
    if (reviewText.startsWith("```json") || reviewText.startsWith("```")) {
      reviewText = reviewText.replace(/```json|```/g, "").trim();
    }

    const review = JSON.parse(reviewText);

    // Update artifact with AI review (stored in a related table or as metadata)
    // For now, we'll just return it - in production, you might want to store it
    const updatedArtifact = {
      ...artifact,
      aiReview: review,
    };

    return NextResponse.json({ artifact: updatedArtifact });
  } catch (error) {
    console.error("Error generating AI review:", error);
    return NextResponse.json(
      { error: "Failed to generate AI review" },
      { status: 500 }
    );
  }
}
