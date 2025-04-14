"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getCachedData, CACHE_TTL } from "@/lib/redis";
import {GoogleGenerativeAI} from "@google/generative-ai"

let model:any;

if(process.env.GEMINI_API_KEY){

  const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  model=genAI.getGenerativeModel({
    model:"gemini-1.5-flash"
  })
}


interface SalaryRange {
  role: string;
  min: number;
  max: number;
  median: number;
  location: string;
}

interface AIInsights {
  industry: string;
  salaryRanges: SalaryRange[];
  growthRate: number;
  demandLevel: "HIGH" | "MEDIUM" | "LOW";
  topSkills: string[];
  marketOutLook: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  keyTrends: string[];
  recommendedSkills: string[];
}

export const generateAIinsights = async (industry: string): Promise<AIInsights> => {
  return getCachedData(
    `insights:industry:${industry}`,
    async()=>{
      const prompt = `
      Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
      {
        "salaryRanges": [
          { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
        ],
        "growthRate": number,
        "demandLevel": "HIGH" | "MEDIUM" | "LOW",
        "topSkills": ["skill1", "skill2"],
        "marketOutLook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
        "keyTrends": ["trend1", "trend2"],
        "recommendedSkills": ["skill1", "skill2"]
      }
      
      IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
      Include at least 5 common roles for salary ranges.
      Growth rate should be a percentage.
      Include at least 5 skills and trends.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
  
    return JSON.parse(cleanedText) as AIInsights;
    },CACHE_TTL.WEEK
  )

};

export async function getDashboardInsights() {
  const {userId}=await auth();
  if(!userId) throw new Error("User Not Authorized");
  
  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    },
    include: {
      industryInsight: true
    }
  })
  if(!user) throw new Error("User Not Found");
  
  const cacheKey=`dashboard:insights:${user.id}`
  return getCachedData(
    cacheKey,
    async()=>{
      if(!user.industryInsight){
        if (!user.industry) throw new Error("User industry is not defined");
        const insights = await generateAIinsights(user.industry);
    
        const industryInsight=await db.industryInsight.create({
          data:{
            ...insights,
            salaryRanges: insights.salaryRanges.map(range => ({
              role: range.role,
              min: range.min,
              max: range.max,
              median: range.median,
              location: range.location
            })), 
            nextUpdated:new Date(Date.now()+7*24*60*60*1000)
          }
        })
        return industryInsight;
      }
      return user.industryInsight;

    },CACHE_TTL.MEDIUM
  )
}