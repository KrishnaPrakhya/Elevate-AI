"use server"
import { db } from "@/lib/prisma";
import { CACHE_TTL, getCachedData, invalidateCache } from "@/lib/redis";
import { auth } from "@clerk/nextjs/server";
import { optimizeResumeSection, analyzeSkillGaps } from "@/lib/ai/career-agent";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

export async function saveResume(content:string) {
  const {userId}=await auth();
  if(!userId) throw new Error("User Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User Not Found")
try {
  const resume=await db.resume.upsert({
    where:{
      userId:user.id
    },
    update:{
      content
    },
    create:{
      userId:user.id,
      content,
    }
  })
  await invalidateCache(`resume:${user.id}`)
  revalidatePath("/resume");
  return resume;
} catch (error) {
  console.error("Error saving resume:",error);
  throw new Error("Failed to save resume");
}

  }

export async function getResume() {
  const {userId}=await auth();
  if(!userId) throw new Error("User Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User Not Found");
  return getCachedData(
    `resume:${user.id}`,
    async()=>{
      return await db.resume.findUnique({
        where:{
          userId:user.id
        }
      })
    },CACHE_TTL.MEDIUM
  )
}

interface props{
  type:string,
  current:string
}

export async function improveWithAI(content:props) {
  const {type,current}=content;
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");
  const cacheKey = `improve:${user.id}:${type}:${Buffer.from(current).toString("base64").substring(0, 20)}`

  return getCachedData(
    cacheKey,
    async () => {
      // Use AI career agent for resume optimization
      const result = await optimizeResumeSection(
        type,
        current,
        user.industry || "general"
      );

      return result.optimized;
    },
    CACHE_TTL.MEDIUM
  );
}

export async function getResumeAIAnalysis(resumeContent: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const cacheKey = `resume-analysis:${user.id}:${Buffer.from(resumeContent.substring(0, 100)).toString("base64").substring(0, 20)}`;

  return getCachedData(
    cacheKey,
    async () => {
      const result = await optimizeResumeSection(
        "full-resume",
        resumeContent,
        user.industry || "general"
      );

      return {
        optimized: result.optimized,
        suggestions: result.suggestions,
        atsScore: result.atsScore,
      };
    },
    CACHE_TTL.LONG
  );
}

export async function analyzeResume(resumeContent: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  })

  if (!user) throw new Error("User not found")
    const contentHash = Buffer.from(resumeContent).toString("base64").substring(0, 20)
  const cacheKey = `analyze:${user.id}:${contentHash}`
      return getCachedData(
        cacheKey,
        async () => {
      const prompt = `
        As an expert resume reviewer, analyze the following resume for a ${user.industry} professional.
        Provide a comprehensive analysis with scores and feedback.
        
        Resume content:
        ${resumeContent}
        
        Return the analysis in this JSON format only:
        {
          "overall": number, // 0-100 score
          "sections": [
            {
              "name": string, // e.g., "Summary", "Experience", "Skills", etc.
              "score": number, // 0-100 score
              "feedback": string // Specific feedback for this section
            }
          ],
          "suggestions": [
            {
              "id": string, // Unique ID
              "type": string, // "summary", "skills", "experience", etc.
              "section": string, // Human-readable section name
              "content": string, // Suggested content
              "reason": string, // Reason for the suggestion
              "index": number // Optional: index for array items like experience entries
            }
          ]
        }
        
        Provide at least 3-5 specific suggestions for improvement. Focus on content, not formatting.
      `

      try {
        const result = await model.chat.completions.create({
        model: "minimax-m2.7",
        messages: [{ role: "user", content: prompt }],
      });
      let analysisText = result.choices[0]?.message?.content?.trim() || "";
        if (analysisText.startsWith("```json") || analysisText.startsWith("```")) {
          analysisText = analysisText.replace(/```json|```/g, "").trim()
        }
        return JSON.parse(analysisText)
        
        
      } catch (error) {
        console.error("Error analyzing resume:", error)
        throw new Error("Failed to analyze resume")
      }
    },CACHE_TTL.MEDIUM)
  }
  


interface TailorProps {
  resumeContent: string
  jobDescription: string
}

export async function tailorToJob(data: TailorProps) {
  const { resumeContent, jobDescription } = data
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  })

  if (!user) throw new Error("User not found")

    const resumeHash = Buffer.from(resumeContent).toString("base64").substring(0, 10)
    const jobHash = Buffer.from(jobDescription).toString("base64").substring(0, 10)
    const cacheKey = `tailor:${user.id}:${resumeHash}:${jobHash}`
    return getCachedData(
      cacheKey,
      async () => {
      const prompt = `
        As an expert resume writer, tailor the following resume to match the provided job description.
        Identify key skills and requirements from the job description and modify the resume to highlight relevant experience.
        
        Resume content:
        ${resumeContent}
        
        Job Description:
        ${jobDescription}
        
        Return only the modified sections in this JSON format:
        {
          "summary": string, // Modified summary
          "skills": string, // Modified skills
          "experience": [
            {
              "index": number, // Index of the experience entry (0-based)
              "description": string // Modified description
            }
          ]
        }
        
        Focus on highlighting relevant experience and incorporating keywords from the job description.
        Do not include sections that don't need modification.
      `

      try {
        const result = await model.chat.completions.create({
        model: "minimax-m2.7",
        messages: [{ role: "user", content: prompt }],
      });
      const tailoredContent = result.choices[0]?.message?.content?.trim() || ""
        return JSON.parse(tailoredContent)
      } catch (error) {
        console.error("Error tailoring resume:", error)
        throw new Error("Failed to tailor resume")
      }
    },
  CACHE_TTL.MEDIUM)
  }
