"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generatePersonalizedInterviewQuiz } from "@/lib/ai/career-agent";
import { CACHE_TTL, getCachedData, invalidateCache, redis } from "@/lib/redis";

type ActivePlan = {
  targetRole: string;
  planDetails?: {
    topGaps?: { skill: string; importance: number }[];
  };
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
  } catch (error: any) {
    console.error("Error generating interview quiz:", error);
    throw new Error("Failed to generate quiz");
  }
}

export const saveQuizResult= async (questions:any[],answers:any[],score:number)=>{
  const {userId}=await auth();
  if(!userId) throw new Error("User is Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User not Found");
  const questionResults=questions.map((q,index)=>({
    question:q.question,
    correctAnswer:q.correctAnswer,
    userAnswer:answers[index],
    isCorrect:q.correctAnswer===answers[index],
    explanation:q.explanation
  }))
  console.log(questionResults)
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
        quizScore:score,
        questions:questionResults,
        category:"Technical",
        improvementTip,
      }
    })

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