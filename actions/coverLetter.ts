"use server"

import { db } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { revalidatePath } from "next/cache"
import { getCachedData, invalidateCache, CACHE_TTL } from "@/lib/redis"

let model: any

if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  })
}

interface CoverLetterProp {
  content: any
  jobTitle: string
  jobDescription: string
  companyName: string
  templateId: string
}

export const saveCoverLetter = async (contentRes: CoverLetterProp) => {
  const { userId } = await auth()
  const { content, jobTitle, jobDescription, companyName, templateId } = contentRes
  if (!userId) throw new Error("User Unauthorized")

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  })
  if (!user) throw new Error("User not Found")

  try {
    // Create a new cover letter instead of upsert to allow multiple cover letters
    const coverLetter = await db.coverLetter.create({
      data: {
        userId: user.id,
        jobTitle,
        jobDescription,
        companyName,
        templateId,
        content,
      },
    })

    // Invalidate the cover letters cache for this user
    await invalidateCache(`coverLetters:${user.id}`)

    revalidatePath("/coverLetter")
    return coverLetter
  } catch (error) {
    console.log(error)
    throw new Error("Failed to save cover letter")
  }
}

export const getCoverLetters = async () => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized User")

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  })

  if (!user) throw new Error("User Not Found")

  // Use the cache helper to get or fetch the cover letters
  return getCachedData(
    `coverLetters:${user.id}`,
    async () => {
      return db.coverLetter.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    },
    CACHE_TTL.SHORT, // Short cache time since cover letters might be updated frequently
  )
}

export const getCoverLetterById = async (id: string) => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized User")

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  })

  if (!user) throw new Error("User Not Found")

  // Use the cache helper to get or fetch the specific cover letter
  return getCachedData(
    `coverLetter:${id}`,
    async () => {
      return db.coverLetter.findFirst({
        where: {
          id,
          userId: user.id,
        },
      })
    },
    CACHE_TTL.MEDIUM,
  )
}

export const deleteCoverLetter = async (id: string) => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized User")

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  })

  if (!user) throw new Error("User Not Found")

  try {
    await db.coverLetter.delete({
      where: {
        id,
        userId: user.id,
      },
    })

    // Invalidate both the specific cover letter cache and the list cache
    await invalidateCache(`coverLetter:${id}`)
    await invalidateCache(`coverLetters:${user.id}`)

    revalidatePath("/coverLetter")
    return { success: true }
  } catch (error) {
    console.error("Error deleting cover letter:", error)
    throw new Error("Failed to delete cover letter")
  }
}

interface ImproveProps {
  type: string
  current: string
}

export async function improveWithAICoverLetter(content: ImproveProps) {
  const { type, current } = content
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  })

  if (!user) throw new Error("User not found")

  // Create a cache key based on the content and type
  const cacheKey = `improve:coverLetter:${user.id}:${type}:${Buffer.from(current).toString("base64").substring(0, 20)}`

  return getCachedData(
    cacheKey,
    async () => {
      const prompt = `
        As an expert Cover Letter writer, improve the following ${type} for a ${user.industry} professional.
        Make it more impactful, quantifiable, and aligned with industry standards.
        Current content: "${current}"

        Requirements:
        1. Use action verbs
        2. Include metrics and results where possible
        3. Highlight relevant technical skills
        4. Keep it concise but detailed
        5. Focus on achievements over responsibilities
        6. Use industry-specific keywords
        
        Format the response as a single paragraph without any additional text or explanations.
      `

      try {
        const result = await model.generateContent(prompt)
        const response = result.response
        const improvedContent = response.text().trim()
        return improvedContent
      } catch (error) {
        console.error("Error improving content:", error)
        throw new Error("Failed to improve content")
      }
    },
    CACHE_TTL.LONG, // Cache AI improvements for longer since they're expensive
  )
}

export const analyzeCoverLetter = async (content: string) => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  })

  if (!user) throw new Error("User not found")

  // Create a cache key based on the cover letter content
  const contentHash = Buffer.from(content).toString("base64").substring(0, 20)
  const cacheKey = `analyze:coverLetter:${user.id}:${contentHash}`

  return getCachedData(
    cacheKey,
    async () => {
      const prompt = `
        As an expert Cover Letter reviewer, analyze the following Cover Letter for a ${user.industry} professional.
        Provide a comprehensive analysis with scores and feedback.
        
        Cover Letter content:
        ${content}
        
        Return the analysis in this JSON format only:
        {
          "overall": number, // 0-100 score
          "sections": [
            {
              "name": string, // e.g., "Introduction", "Body", "Closing", etc.
              "score": number, // 0-100 score
              "feedback": string // Specific feedback for this section
            }
          ],
          "suggestions": [
            {
              "id": string, // Unique ID
              "type": string, // "introduction", "body", "closing", etc.
              "section": string, // Human-readable section name
              "content": string, // Suggested content
              "reason": string, // Reason for the suggestion
              "index": number // Optional: index for array items
            }
          ]
        }
        
        Provide at least 3-5 specific suggestions for improvement. Focus on content, not formatting.
      `

      try {
        const result = await model.generateContent(prompt)
        const response = result.response
        let analysisText = response.text().trim()
        if (analysisText.startsWith("```json") || analysisText.startsWith("```")) {
          analysisText = analysisText.replace(/```json|```/g, "").trim()
        }
        return JSON.parse(analysisText)
      } catch (error) {
        console.error("Error analyzing Cover Letter:", error)
        throw new Error("Failed to analyze Cover Letter")
      }
    },
    CACHE_TTL.MEDIUM,
  )
}

interface TailorProps {
  coverLetterContent: string
  jobDescription: string
}

export async function tailorToJobCoverLetter(data: TailorProps) {
  const { coverLetterContent, jobDescription } = data
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  })

  if (!user) throw new Error("User not found")

  // Create a cache key based on both cover letter and job description
  const coverLetterHash = Buffer.from(coverLetterContent).toString("base64").substring(0, 10)
  const jobHash = Buffer.from(jobDescription).toString("base64").substring(0, 10)
  const cacheKey = `tailor:coverLetter:${user.id}:${coverLetterHash}:${jobHash}`

  return getCachedData(
    cacheKey,
    async () => {
      const prompt = `
        As an expert Cover Letter writer, tailor the following Cover Letter to match the provided job description.
        Identify key skills and requirements from the job description and modify the cover letter to highlight relevant experience.
        
        Cover Letter content:
        ${coverLetterContent}
        
        Job Description:
        ${jobDescription}
        
        Return only the modified sections in this JSON format:
        {
          "introduction": string, // Modified introduction
          "body": string, // Modified body paragraphs
          "closing": string // Modified closing paragraph
        }
        
        Focus on highlighting relevant experience and incorporating keywords from the job description.
        Do not include sections that don't need modification.
      `

      try {
        const result = await model.generateContent(prompt)
        const response = result.response
        const tailoredContent = response.text().trim()
        return JSON.parse(tailoredContent)
      } catch (error) {
        console.error("Error tailoring Cover Letter:", error)
        throw new Error("Failed to tailor Cover Letter")
      }
    },
    CACHE_TTL.MEDIUM,
  )
}

export const generateCoverLetter = async (jobTitle: string, companyName: string, jobDescription: string) => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      resume: true,
    },
  })

  if (!user) throw new Error("User not found")

  // Create a cache key based on job details
  const jobDetailsHash = Buffer.from(`${jobTitle}${companyName}${jobDescription}`).toString("base64").substring(0, 20)
  const cacheKey = `generate:coverLetter:${user.id}:${jobDetailsHash}`

  return getCachedData(
    cacheKey,
    async () => {
      // Get the user's resume if available to personalize the cover letter
      const resumeContent = user.resume?.content || ""

      const prompt = `
        As an expert Cover Letter writer, create a professional cover letter for a ${user.industry} professional applying for a ${jobTitle} position at ${companyName}.
        
        Job Description:
        ${jobDescription}
        
        ${
          resumeContent
            ? `Resume Content (for reference):
        ${resumeContent}`
            : ""
        }
        
        User Information:
        - Industry: ${user.industry || "Not specified"}
        - Experience: ${user.experience || "Not specified"} years
        - Skills: ${user.skills?.join(", ") || "Not specified"}
        
        Create a complete cover letter with:
        1. A personalized introduction that mentions the company and position
        2. 2-3 body paragraphs highlighting relevant skills and experiences
        3. A strong closing paragraph with a call to action
        
        Format the response in markdown. Make it professional, concise, and tailored to the job description.
        The cover letter should be approximately 300-400 words.
      `

      try {
        const result = await model.generateContent(prompt)
        const response = result.response
        return response.text().trim()
      } catch (error) {
        console.error("Error generating cover letter:", error)
        throw new Error("Failed to generate cover letter")
      }
    },
    CACHE_TTL.LONG, // Cache generated cover letters for longer
  )
}
