"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
let model:any;

if(process.env.GEMINI_API_KEY){

  const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  model=genAI.getGenerativeModel({
    model:"gemini-1.5-flash"
  })
}
export async function generateTopicQuiz(topics:string[]){
  const {userId}=await auth();
  if(!userId) throw new Error("User is Unauthorized");

  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User not Found");
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
    const res=await model.generateContent(prompt);
    const response = res.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    const quiz=JSON.parse(cleanedText);
    return quiz.questions;
  } catch (error:any) {
    console.log(error);
    throw new Error(error);
  }
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

  try {
    const prompt = `
      Generate comprehensive learning content for the following topics: ${topics.join(", ")}.
      The content should be technical and suitable for a ${user.industry} professional${
      user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
    }.
      
      Return the response in Markdown format with clear headings and sections for each topic.
      Include explanations, examples, and best practices where applicable.
    `;

    const res = await model.generateContent(prompt);
    const response = res.response;
    const text = response.text();
    return text;
  } catch (error: any) {
    console.error(error);
    throw new Error("Failed to generate topic content");
  }
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
  const skills=user?.industryInsight?.topSkills;
  if(!user) throw new Error("User Not Found");
    try {
    
    const prompt = `
      Generate important sub-topics for a ${
        user.industry
      } professional only in these topics ${skills?.join(", ")}
    }.
      
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
    const res=await model.generateContent(prompt);
    const response = res.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    const topics=JSON.parse(cleanedText);
    return topics;
  } catch (error:any) {
    console.log(error);
    throw new Error(error);
  }
}

