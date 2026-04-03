"use server";

import { db } from "@/lib/prisma";
import { checkUser } from "@/lib/checkUser";
import { currentUser } from "@clerk/nextjs/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export async function generateHyperPath(targetJob: string) {
  const user = await checkUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    include: { resume: true },
  });

  if (!dbUser) throw new Error("User not found");

  const prompt = `
  You are an expert career coach and technical mentor. 
  The user wants to become a ${targetJob}.
  Based on their skills: ${dbUser.skills?.join(", ")}
  And their resume text: ${dbUser.resume?.content}
  
  Generate exactly 3 missing skills they need to acquire to land the ${targetJob} role.
  Provide a short, actionable description of how to learn it through a simulation.
  Return JSON format.
  `;

  // Note: Depending on your exact installed SDK versions, you may need to adjust the model interface.
  // Using generic placeholder for the AI logic.
  // In a real implementation you would use your langchain or ai-sdk setup here.

  return {
      message: "This is a placeholder for generating the Hyper-path based on the user's resume and target job.",
      skills: ["React Server Components", "Docker Compose", "System Architecture"]
  };
}

export async function getSkillGraph() {
  const user = await checkUser();
  if (!user) throw new Error("Unauthorized");
  
  const skillProgress = await db.userSkillProgress.findMany({
    where: { userId: user.id },
    include: { skill: true }
  });

  return skillProgress;
}
