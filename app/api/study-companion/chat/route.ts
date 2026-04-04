import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

/**
 * Format markdown response for consistent rendering
 */
function formatMarkdownResponse(content: string): string {
  if (!content) return content;

  let formatted = content;

  // Ensure blank lines before and after tables
  formatted = formatted.replace(/(\|[^|]+\|.*\n)(\|[-| ]+\|)/g, "\n$1\n$2\n");

  // Ensure blank lines before headings
  formatted = formatted.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  // Ensure blank lines before code blocks
  formatted = formatted.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  // Normalize multiple blank lines to single blank line
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, currentLessonId } = body;

    if (!message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        enrollments: {
          include: {
            learningPath: true,
            lessonProgress: {
              include: { lesson: true },
            },
          },
        },
        skillProgress: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get context from current lesson/path if available
    let lessonContext = "";
    if (currentLessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: currentLessonId },
        include: { module: { include: { learningPath: true } } },
      });
      if (lesson) {
        lessonContext = `
          Current Lesson: ${lesson.title}
          Module: ${lesson.module.title}
          Learning Path: ${lesson.module.learningPath.title}
          Lesson Content: ${lesson.content.substring(0, 500)}...
        `;
      }
    }

    // Get user's learning context
    const learningContext = `
      User's Industry: ${user.industry || "Not specified"}
      User's Experience: ${user.experience || 0} years
      User's Skills: ${user.skillProgress.map((sp) => `${sp.skill.name} (${sp.masteryLevel}% mastery)`).join(", ")}
      Active Enrollments: ${user.enrollments.map((e) => e.learningPath.title).join(", ")}
      ${lessonContext}
    `;

    // Determine message type and generate appropriate response
    const messageLower = message.toLowerCase();
    let responseType = "answer";
    let systemPrompt = "You are a helpful AI Study Companion.";

    if (messageLower.includes("quiz") || messageLower.includes("test")) {
      responseType = "quiz";
      systemPrompt = "You are an AI tutor creating quiz questions.";
    } else if (messageLower.includes("explain") || messageLower.includes("what is")) {
      responseType = "explanation";
      systemPrompt = "You are an expert teacher explaining concepts clearly.";
    } else if (messageLower.includes("how") || messageLower.includes("help")) {
      responseType = "guidance";
      systemPrompt = "You are a supportive study coach providing guidance.";
    }

    const prompt = `
      ${systemPrompt}

      Student Context:
      ${learningContext}

      Student's Question: ${message}

      Provide a helpful, educational response that:
      1. Directly answers the question
      2. Uses examples relevant to the student's background and industry
      3. Breaks down complex concepts into understandable parts
      4. Encourages active learning and critical thinking
      5. Suggests related topics to explore

      ${responseType === "quiz" ? "Include 2-3 practice questions at the end." : ""}
      ${responseType === "explanation" ? "Use analogies and real-world examples to make it clear." : ""}

      Also suggest 3-5 follow-up questions the student might want to ask.

      Return a JSON object in this format (no markdown):
      {
        "response": "Your detailed response here",
        "type": "${responseType}",
        "suggestions": ["follow-up question 1", "follow-up question 2", "follow-up question 3"],
        "resources": [
          {
            "title": "Related resource title",
            "url": "https://...",
            "type": "lesson | path | external"
          }
        ]
      }

      For resources, suggest relevant lessons from their enrollments or external learning resources.
    `;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI Study Companion. Always respond with valid JSON in this exact format: {\"response\": \"your answer\", \"type\": \"answer|quiz|explanation|guidance\", \"suggestions\": [\"question 1\", \"question 2\", \"question 3\"], \"resources\": []}. Do not use markdown. Do not include any text outside the JSON object."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    }).catch((err) => {
      console.error("OpenAI API call failed:", err);
      throw err;
    });

    let responseText = result.choices[0]?.message?.content?.trim() || "";

    console.log("Raw AI response:", responseText);

    // Clean up markdown
    if (responseText.startsWith("```json") || responseText.startsWith("```")) {
      responseText = responseText.replace(/```json|```/g, "").trim();
    }

    // Also clean any text before/after JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    // Fallback if parsing fails
    let response;
    try {
      response = JSON.parse(responseText);
      // Format the response content for consistent markdown rendering
      if (response.response) {
        response.response = formatMarkdownResponse(response.response);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, "Response was:", responseText);
      response = {
        response: formatMarkdownResponse("I apologize, but I'm having trouble formatting my response. Let me help you directly: " + responseText),
        type: "answer",
        suggestions: ["Can you explain more?", "Give me an example", "What should I learn next?"],
        resources: []
      };
    }

    // Generate new conversation ID (in production, use actual conversation tracking)
    const newConversationId = conversationId || `conv-${Date.now()}`;

    return NextResponse.json({
      response: response.response,
      type: response.type,
      suggestions: response.suggestions,
      resources: response.resources,
      conversationId: newConversationId,
    });
  } catch (error) {
    console.error("Error in study companion:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get response", details: errorMessage },
      { status: 500 }
    );
  }
}
