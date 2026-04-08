"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generatePersonalizedInterviewQuiz } from "@/lib/ai/career-agent";
import { recordExecutedAction } from "@/lib/performance/intelligence";
import { CACHE_TTL, getCachedData, invalidateCache, redis } from "@/lib/redis";
import { z } from "zod";

type ActivePlan = {
  targetRole: string;
  planDetails?: {
    topGaps?: { skill: string; importance: number }[];
  };
};

type QuizQuestionInput = {
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
};

export async function generateQuiz(targetRole?: string, weakTopics?: string[]){
  const {userId}=await auth();
  if(!userId) throw new Error("User is Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User not Found");

  const activePlan = await redis.get<ActivePlan>(`career-planner:active:${user.id}`).catch(() => null);
  const planTargetRole = activePlan?.targetRole;
  const planWeakTopics = (activePlan?.planDetails?.topGaps || []).map((g) => g.skill).slice(0, 5);

  const finalTargetRole = targetRole || planTargetRole;
  const finalWeakTopics = (weakTopics && weakTopics.length > 0) ? weakTopics : planWeakTopics;

  const normalizedWeakTopics = (finalWeakTopics || []).map((topic) => topic.trim().toLowerCase()).sort();
  const cacheKey = `interview:quiz:${user.id}:${(finalTargetRole || "general").toLowerCase()}:${Buffer.from(normalizedWeakTopics.join(",")).toString("base64").slice(0, 32)}`;

  try {
    const questions = await getCachedData(
      cacheKey,
      () =>
        generatePersonalizedInterviewQuiz(
          user.industry || "general",
          user.skills || [],
          finalWeakTopics,
          finalTargetRole
        ),
      CACHE_TTL.MEDIUM
    );

    return questions;
  } catch (error) {
    console.error("Error generating interview quiz:", error);
    throw new Error("Failed to generate quiz");
  }
}

const saveQuizResultSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string(),
    explanation: z.string().optional(),
  })),
  answers: z.array(z.string()),
  score: z.number().min(0).max(100),
}).refine((data) => data.questions.length === data.answers.length, {
  message: "Questions and answers length mismatch",
  path: ["answers"],
});

const normalizeAnswerText = (value: string | undefined | null) => {
  if (!value) return "";
  return value
    .trim()
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
};

const stripLeadingOptionLabel = (value: string) => {
  return value
    .replace(/^\s*(?:option\s+)?(?:[\[(]?\s*(?:[a-d]|[1-4])\s*[\])\.:\-])\s*/i, "")
    .trim();
};

const extractOptionIndex = (value: string) => {
  const match = value
    .trim()
    .match(/^(?:option\s+)?[\[(]?\s*([a-d]|[1-4])\s*[\])\.:\-]?\s*$/i);

  if (!match) return null;

  const token = match[1].toLowerCase();
  if (/^[1-4]$/.test(token)) {
    return Number(token) - 1;
  }

  return token.charCodeAt(0) - "a".charCodeAt(0);
};

const resolveAnswerForComparison = (answer: string, options: string[] = []) => {
  const normalizedOptions = options.map((option) =>
    normalizeAnswerText(stripLeadingOptionLabel(option))
  );

  const normalizedRaw = normalizeAnswerText(answer);
  const normalizedStripped = normalizeAnswerText(stripLeadingOptionLabel(answer));

  if (normalizedOptions.includes(normalizedRaw)) {
    return normalizedRaw;
  }

  if (normalizedOptions.includes(normalizedStripped)) {
    return normalizedStripped;
  }

  const optionIndex = extractOptionIndex(answer);
  if (optionIndex !== null && optionIndex >= 0 && optionIndex < normalizedOptions.length) {
    return normalizedOptions[optionIndex];
  }

  return normalizedRaw || normalizedStripped;
};

export const saveQuizResult = async (
  questions: QuizQuestionInput[],
  answers: string[],
  score: number
) => {
  const { userId } = await auth();
  if (!userId) throw new Error("User is Unauthorized");

  // Validate input
  const validated = saveQuizResultSchema.parse({ questions, answers, score });

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId
    }
  })
  if (!user) throw new Error("User not Found");
  const questionResults = validated.questions.map((q, index) => {
    const userAnswer = validated.answers[index];
    const options = q.options ?? [];

    const normalizedCorrect = resolveAnswerForComparison(q.correctAnswer, options);
    const normalizedUser = resolveAnswerForComparison(userAnswer, options);

    return {
      question: q.question,
      correctAnswer: q.correctAnswer,
      userAnswer,
      isCorrect: normalizedCorrect === normalizedUser,
      explanation: q.explanation,
    };
  });

  const correctCount = questionResults.filter((q) => q.isCorrect).length;
  const computedScore =
    validated.questions.length > 0
      ? Number(((correctCount / validated.questions.length) * 100).toFixed(2))
      : 0;

  const wrongAnswers=questionResults.filter((q)=>!q.isCorrect);
  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}"\nCorrect Answer: "${q.correctAnswer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    // AI-powered improvement tip with learning recommendations
    const improvementPrompt = `
      The user got the following ${user.industry} technical interview questions wrong:

      ${wrongQuestionsText}

      Based on these mistakes:
      1. Provide a concise, specific improvement tip
      2. Suggest 1-2 specific topics to study
      3. Recommend a learning approach (course, project, practice)

      Keep it encouraging and actionable (under 3 sentences).
    `;
    try {
      const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
      const OpenAI = (await import("openai")).default;
      const model = new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl });

      const tipResult2 = await model.chat.completions.create({
        model: "gpt-oss:20b-cloud",
        messages: [{ role: "user", content: improvementPrompt }],
      });

      improvementTip = tipResult2.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      console.error("Error generating improvement tip:", error);
    }

  }
  try {
    const assessment=await db.assessments.create({
      data:{
        userId:user.id,
        quizScore:computedScore,
        questions:questionResults,
        category:"Technical",
        improvementTip,
      }
    })

    await recordExecutedAction({
      userId: user.id,
      type: "UPDATE_PROGRESS",
      title: "Technical quiz completed",
      description:
        "Interview quiz result was recorded and used to refine your next recommended learning actions.",
      params: {
        score: computedScore,
        totalQuestions: validated.questions.length,
        wrongAnswers: wrongAnswers.length,
      },
      result: {
        assessmentId: assessment.id,
        improvementTip,
      },
      metadata: {
        source: "interview-quiz",
        reason:
          "Quiz performance contributes to interview cadence decisions and targeted weak-area recommendations.",
      },
    });

    await invalidateCache(`interview:assessments:${user.id}`)
    
    return assessment;
  } catch (error) {
    
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}


export const getAssessments=async()=>{
  const {userId}=await auth();
  if(!userId) throw new Error("User is Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User not Found");
  const assessments=await getCachedData(
    `interview:assessments:${user.id}`,
    () =>
      db.assessments.findMany({
        where:{
          userId:user.id
        }
      }),
    CACHE_TTL.SHORT
  )
  return assessments;
}