"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getCachedData, CACHE_TTL, redis } from "@/lib/redis";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});
export async function generateTopicQuiz(topics:string[]){
  const {userId}=await auth();
  if(!userId) throw new Error("User is Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User not Found");

  // Create cache key
  const cacheKey = `topicQuiz:${user.industry}:${Buffer.from(topics.join(",")).toString("base64").substring(0, 20)}`;

  return getCachedData(
    cacheKey,
    async () => {
      try {
        const prompt = `
          Generate 10 technical interview questions for a ${
            user.industry
          } professional${
          user.skills?.length ? ` with expertise in ${user.skills.join(", ")} only in these topics ${topics.join(", ")}` : ""
        }.

          Each question should be multiple choice with 4 options.

          Return the response in this JSON format only, no additional text:
          {
            "questions": [
              {
                "question": "string",
                "options": ["string", "string", "string", "string"],
                "correctAnswer": "string",
                "explanation": "string"
              }
            ]
          }
        `;
        const res = await model.chat.completions.create({
          model: "gpt-oss:20b-cloud",
          messages: [{ role: "user", content: prompt }],
        });
        const text = res.choices[0]?.message?.content || "";
        const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
        const quiz=JSON.parse(cleanedText);
        return quiz.questions;
      } catch (error:any) {
        console.log(error);
        throw new Error(error);
      }
    },
    CACHE_TTL.LONG // Cache for 24 hours
  );
}
export async function generateTopicContent(topics: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("User is Unauthorized");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId
    }
  });
  if (!user) throw new Error("User not Found");

  const cacheKey = `topicContent:v2:${user.id}:${Buffer.from(topics.map((t) => t.trim().toLowerCase()).sort().join(",")).toString("base64").substring(0, 28)}`;

  return getCachedData(
    cacheKey,
    async () => {
      try {
        const prompt = `
      Generate comprehensive learning content for the following topics: ${topics.join(", ")}.
      The content should be technical and suitable for a ${user.industry} professional${
      user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
    }.

      Output requirements (strict):
      1. Return valid Markdown only.
      2. Use headings, short paragraphs, and bullet lists.
      3. Do NOT use Markdown tables.
      4. Do NOT use pipe-delimited rows (for example: | A | B | C |).
      5. For tool comparisons, use this format:
         - Tool Name: one-line explanation and when to use it.
      6. Keep code snippets in fenced blocks with a language tag.

      Include explanations, examples, and best practices where applicable.
    `;

        const res = await model.chat.completions.create({
          model: "gpt-oss:20b-cloud",
          messages: [{ role: "user", content: prompt }],
        });
        const text = res.choices[0]?.message?.content || "";
        return text;
      } catch (error: any) {
        console.error(error);
        throw new Error("Failed to generate topic content");
      }
    },
    CACHE_TTL.LONG
  );
}

export async function getTopTopics(){
  const {userId} = await auth();
  if(!userId) throw new Error("User is Unauthorized");
  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    },
    include:{
      industryInsight:true
    }

  })
  if(!user) throw new Error("User Not Found");

  // Check if user has an active career plan with weak areas (skill gaps)
  const activePlan = await redis.get<{ planDetails?: { topGaps?: { skill: string }[] } }>(`career-planner:active:${user.id}`).catch(() => null);
  const planWeakAreas = activePlan?.planDetails?.topGaps?.map((g) => g.skill) || [];

  // Use career plan weak areas if available, otherwise fall back to industry top skills
  const skills = planWeakAreas.length > 0 ? planWeakAreas : (user?.industryInsight?.topSkills || []);

  // Create cache key based on user's industry and skills
  const cacheKey = `topTopics:${user.industry}:${Buffer.from(skills.join(",")).toString("base64").substring(0, 20)}`;

  return getCachedData(
    cacheKey,
    async () => {
      try {
        const prompt = `
          Generate important sub-topics for a ${
            user.industry
          } professional${planWeakAreas.length > 0 ? ' focusing on these weak areas/skill gaps' : ''} only in these topics ${skills.join(", ")}


          Each skill should contain atleast 5 important and most asked topics from the corresponding skills.

          Return the response in this JSON format only, no additional text:
          [
          {
            "name":"skill1",
            "subtopics": ["subtopic-1", "subtopic2",...],

        },
          {
            "name":"skill2",
            "subtopics": ["subtopic-1", "subtopic2",...],

        },...
        ]
        `;
        const res = await model.chat.completions.create({
          model: "gpt-oss:20b-cloud",
          messages: [{ role: "user", content: prompt }],
        });
        const text = res.choices[0]?.message?.content || "";
        const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
        const topics=JSON.parse(cleanedText);
        return topics;
      } catch (error:any) {
        console.log(error);
        throw new Error(error);
      }
    },
    CACHE_TTL.WEEK // Cache for a week since topics don't change often
  );
}

