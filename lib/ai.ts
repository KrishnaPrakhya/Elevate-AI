import OpenAI from "openai";
import { parseLLMJson } from "@/lib/ai/json";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function resolveGroqBaseUrl(): string {
  const configured = process.env.GROQ_BASE_URL?.replace(/\/+$/, "");

  // This project no longer supports self-hosted OpenAI-compatible providers.
  // Ignoring a stale Ollama/Cloudflare URL avoids opaque 5xx errors in Vercel.
  if (configured && configured !== GROQ_BASE_URL) {
    console.warn("Ignoring GROQ_BASE_URL because Elevate AI uses the official Groq endpoint.");
  }

  return GROQ_BASE_URL;
}

function shouldUseFallback(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status === 498 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const description = `${error.name} ${error.message}`.toLowerCase();
  return description.includes("timeout") || description.includes("network") || description.includes("connection");
}

/**
 * Retries one provider failure with the secondary Groq project key. Both keys
 * access the same Groq API; this protects the app from per-key rate limits or
 * a temporarily unhealthy request path without retrying invalid requests.
 */
async function groqFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const fallbackKey =
    process.env.GROQ_API_KEY_FALLBACK || process.env.GROQ_FALLBACK_API_KEY;

  const requestWithFallbackKey = () => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${fallbackKey}`);
    return globalThis.fetch(input, { ...init, headers });
  };

  try {
    const response = await globalThis.fetch(input, init);
    if (!fallbackKey || !shouldUseFallback(response.status)) {
      return response;
    }

    console.warn(`Groq primary key received HTTP ${response.status}; retrying once with fallback key.`);
    return requestWithFallbackKey();
  } catch (error) {
    if (!fallbackKey || !isRetryableNetworkError(error)) {
      throw error;
    }

    console.warn("Groq primary request failed at the network layer; retrying once with fallback key.");
    return requestWithFallbackKey();
  }
}

export function createGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY || "missing-groq-api-key";
  const baseURL = resolveGroqBaseUrl();

  return new OpenAI({
    apiKey,
    baseURL,
    // Let groqFetch decide whether to retry with the fallback key. Otherwise
    // the SDK would retry the same rate-limited primary key first.
    maxRetries: 0,
    fetch: groqFetch,
  });
}

export const model = createGroqClient();
export const MODEL_NAME = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

// Common prompt templates for cross-feature recommendations
export const PROMPT_TEMPLATES = {
  skillRecommendations: `As an expert career advisor, analyze this professional's profile and recommend 3-5 specific skills they should develop to advance in their career.

Profile:
- Industry: {industry}
- Current Experience: {experience} years
- Current Skills: {currentSkills}
- Target Role: {targetRole}

Consider:
1. Industry trends and in-demand skills
2. Skills that complement their existing expertise
3. Skills that would help them reach their target role
4. Both technical and soft skills

Return ONLY a JSON array of skill objects:
[
  {
    "skill": "skill name",
    "reason": "why this skill is recommended",
    "priority": "high" | "medium" | "low",
    "category": "technical" | "soft" | "domain"
  }
]`,

  learningPathRecommendation: `As a learning advisor, recommend the best type of learning path for this professional.

Profile:
- Industry: {industry}
- Current Skills: {currentSkills}
- Skill Gap: {skillGap}
- Experience Level: {experience} years

Return ONLY a JSON object:
{
  "recommendedFocus": "main skill/topic to focus on",
  "learningPathType": "foundational" | "advanced" | "specialization" | "certification",
  "estimatedHours": number,
  "reasoning": "brief explanation"
}`,

  resumeSkillGap: `Analyze this resume and identify skill gaps compared to industry standards.

Industry: {industry}
Resume Skills: {currentSkills}
Industry Top Skills: {industrySkills}

Return ONLY a JSON array of missing skills:
[
  {
    "skill": "missing skill",
    "importance": "critical" | "important" | "nice-to-have",
    "category": "technical" | "soft" | "tool"
  }
]`,

  interviewTopicMapping: `Map this interview quiz topic to relevant learning areas.

Topic: {topic}
Industry: {industry}
Wrong Answer Context: {context}

Return ONLY a JSON object:
{
  "primaryTopic": "main topic area",
  "relatedTopics": ["related topic 1", "related topic 2"],
  "learningObjective": "what the user should learn"
}`
};

export async function generateSkillRecommendations(
  industry: string,
  experience: number,
  currentSkills: string[],
  targetRole?: string
): Promise<Array<{
  skill: string;
  reason: string;
  priority: "high" | "medium" | "low";
  category: "technical" | "soft" | "domain";
}>> {
  try {
    const prompt = PROMPT_TEMPLATES.skillRecommendations
      .replace("{industry}", industry)
      .replace("{experience}", experience.toString())
      .replace("{currentSkills}", currentSkills.join(", "))
      .replace("{targetRole}", targetRole || "career advancement");

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "[]";
    const parsed = parseLLMJson<Array<{
      skill: string;
      reason: string;
      priority: "high" | "medium" | "low";
      category: "technical" | "soft" | "domain";
    }>>(text, []);
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.skill === "string") : [];
  } catch (error) {
    console.error("Error generating skill recommendations:", error);
    return [];
  }
}

export async function analyzeResumeSkillGaps(
  industry: string,
  currentSkills: string[],
  industryTopSkills: string[]
): Promise<Array<{
  skill: string;
  importance: "critical" | "important" | "nice-to-have";
  category: "technical" | "soft" | "tool";
}>> {
  try {
    const prompt = PROMPT_TEMPLATES.resumeSkillGap
      .replace("{industry}", industry)
      .replace("{currentSkills}", currentSkills.join(", "))
      .replace("{industrySkills}", industryTopSkills.join(", "));

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "[]";
    const parsed = parseLLMJson<Array<{
      skill: string;
      importance: "critical" | "important" | "nice-to-have";
      category: "technical" | "soft" | "tool";
    }>>(text, []);
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.skill === "string") : [];
  } catch (error) {
    console.error("Error analyzing resume skill gaps:", error);
    return [];
  }
}
