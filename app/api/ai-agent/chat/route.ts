import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

/**
 * Unified AI Agent Chat Endpoint
 *
 * This endpoint acts as a bridge between Next.js and the Python LangGraph backend.
 * It routes requests to the appropriate AI agent based on intent detection.
 *
 * Python Backend: server/app.py (LangGraph multi-agent system)
 * - supervisor: Routes to specialized agents
 * - document_improver: Resume/cover letter improvements
 * - job_searcher: Job search and matching
 * - career_advisor: Career guidance and planning
 * - schedule_generator: Learning schedules
 * - interview_preparer: Interview preparation
 */

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:5328";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, context, agent } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get user profile for context
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        resume: true,
        coverLetter: true,
        assessments: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        skillProgress: {
          include: { skill: true },
        },
        enrollments: {
          include: {
            learningPath: true,
            lessonProgress: {
              include: { lesson: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build comprehensive user context
    const userContext = {
      clerkUserId: userId,
      email: user.email,
      name: user.name,
      industry: user.industry,
      experience: user.experience,
      skills: user.skills,
      bio: user.bio,
      resume: user.resume?.content,
      coverLetter: user.coverLetter?.[0]?.content,
      recentAssessments: user.assessments.map((a) => ({
        category: a.category,
        score: a.quizScore,
        improvementTip: a.improvementTip,
      })),
      skillProgress: user.skillProgress.map((sp) => ({
        skill: sp.skill.name,
        mastery: sp.masteryLevel,
      })),
      activeLearning: user.enrollments.map((e) => ({
        path: e.learningPath.title,
        progress: e.progress,
        currentLesson: e.lessonProgress.find((lp) => lp.status === "IN_PROGRESS")?.lesson.title,
      })),
    };

    // Detect intent if agent not specified
    const detectedAgent = agent || detectAgentIntent(message);

    // Forward to Python LangGraph backend
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          user_profile: userContext,
          agent: detectedAgent,
          context,
        }),
      });

      if (!response.ok) {
        // Fallback to local AI if Python backend is unavailable
        console.warn("Python backend unavailable, using fallback");
        return handleLocalFallback(message, userContext, detectedAgent);
      }

      const data = await response.json();

      return NextResponse.json({
        response: data.response,
        agent: detectedAgent,
        intent: data.intent,
        suggestions: data.suggestions,
        resources: data.resources,
      });
    } catch (error) {
      console.error("Python backend error, using fallback:", error);
      return handleLocalFallback(message, userContext, detectedAgent);
    }
  } catch (error) {
    console.error("Error in AI agent chat:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * Detect which agent should handle the message based on intent
 */
function detectAgentIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Resume/Cover Letter related
  if (
    lowerMessage.includes("resume") ||
    lowerMessage.includes("cover letter") ||
    lowerMessage.includes("cv") ||
    lowerMessage.includes("improve my") ||
    lowerMessage.includes("review my") ||
    lowerMessage.includes("feedback")
  ) {
    return "document_improver";
  }

  // Job Search related
  if (
    lowerMessage.includes("job") ||
    lowerMessage.includes("hiring") ||
    lowerMessage.includes("position") ||
    lowerMessage.includes("opportunity") ||
    lowerMessage.includes("salary") ||
    lowerMessage.includes("company")
  ) {
    return "job_searcher";
  }

  // Interview related
  if (
    lowerMessage.includes("interview") ||
    lowerMessage.includes("interviewer") ||
    lowerMessage.includes("behavioral") ||
    lowerMessage.includes("technical interview") ||
    lowerMessage.includes("prepare for interview") ||
    lowerMessage.includes("mock interview")
  ) {
    return "interview_preparer";
  }

  // Career Planning/Scheduling
  if (
    lowerMessage.includes("plan") ||
    lowerMessage.includes("schedule") ||
    lowerMessage.includes("roadmap") ||
    lowerMessage.includes("timeline") ||
    lowerMessage.includes("career path") ||
    lowerMessage.includes("learning path") ||
    lowerMessage.includes("goal")
  ) {
    return "schedule_generator";
  }

  // General Career Advice
  if (
    lowerMessage.includes("career") ||
    lowerMessage.includes("advice") ||
    lowerMessage.includes("should i") ||
    lowerMessage.includes("how to") ||
    lowerMessage.includes("what should") ||
    lowerMessage.includes("recommend")
  ) {
    return "career_advisor";
  }

  // Default to supervisor for routing
  return "supervisor";
}

/**
 * Local fallback when Python backend is unavailable
 */
async function handleLocalFallback(
  message: string,
  userContext: any,
  agent: string
) {
  // Import OpenAI locally to avoid bundle issues
  const OpenAI = (await import("openai")).default;

  const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

  const model = new OpenAI({
    apiKey: ollamaApiKey,
    baseURL: ollamaBaseUrl,
  });

  const systemPrompt = getAgentSystemPrompt(agent);

  const prompt = `
    ${systemPrompt}

    User Profile:
    - Name: ${userContext.name || "Not provided"}
    - Industry: ${userContext.industry || "Not specified"}
    - Experience: ${userContext.experience || 0} years
    - Skills: ${userContext.skills.join(", ") || "Not specified"}
    - Current Learning: ${userContext.activeLearning.map((l: any) => l.path).join(", ") || "None"}

    User Message: ${message}

    Provide a helpful, personalized response based on the user's background and goals.
  `;

  try {
    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const response = result.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      response,
      agent,
      intent: "local_fallback",
      suggestions: generateSuggestions(agent),
    });
  } catch (error) {
    console.error("Local fallback error:", error);
    return NextResponse.json({
      response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
      agent,
      intent: "error",
    });
  }
}

/**
 * Get system prompt for each agent type
 */
function getAgentSystemPrompt(agent: string): string {
  const prompts: Record<string, string> = {
    document_improver: `You are an expert resume and cover letter reviewer. You provide specific, actionable feedback to improve job application documents. You focus on ATS optimization, clarity, impact, and relevance to the user's industry.`,

    job_searcher: `You are a job search expert who helps users find relevant opportunities, negotiate salaries, and understand company cultures. You provide specific job search strategies and can recommend companies based on the user's profile.`,

    career_advisor: `You are a compassionate career coach who provides personalized guidance. You help users navigate career transitions, identify growth opportunities, and make informed decisions about their professional development.`,

    schedule_generator: `You are a learning and development planner. You create realistic, achievable learning schedules based on the user's goals, available time, and current skill level. You break down complex goals into manageable steps.`,

    interview_preparer: `You are an interview preparation specialist. You help users prepare for both technical and behavioral interviews, provide common questions, suggest answer frameworks (like STAR), and conduct mock interviews.`,

    supervisor: `You are a helpful career assistant who can help with various aspects of career development including resume review, job search, interview prep, and career planning. You provide thoughtful, personalized advice.`,
  };

  return prompts[agent] || prompts.supervisor;
}

/**
 * Generate follow-up suggestions based on agent type
 */
function generateSuggestions(agent: string): string[] {
  const suggestions: Record<string, string[]> = {
    document_improver: [
      "How can I make my resume more ATS-friendly?",
      "What metrics should I add to my experience?",
      "Can you review my cover letter opening?",
    ],
    job_searcher: [
      "What companies are hiring in my field?",
      "How do I negotiate a higher salary?",
      "What's the best job board for tech roles?",
    ],
    career_advisor: [
      "Should I pursue a management or IC track?",
      "How do I know if I should change careers?",
      "What skills should I focus on next?",
    ],
    schedule_generator: [
      "Create a 12-week learning plan for me",
      "How many hours should I study weekly?",
      "What's a realistic timeline for this goal?",
    ],
    interview_preparer: [
      "Give me a practice technical question",
      "How do I answer 'tell me about yourself'?",
      "What questions should I ask the interviewer?",
    ],
    supervisor: [
      "Help me improve my resume",
      "I need interview practice",
      "What's my career path looking like?",
    ],
  };

  return suggestions[agent] || suggestions.supervisor;
}
