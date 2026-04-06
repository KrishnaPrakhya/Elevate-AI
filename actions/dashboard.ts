"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getCachedData, CACHE_TTL } from "@/lib/redis";
import OpenAI from "openai";
import { headers } from "next/headers";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});


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

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  AE: "United Arab Emirates",
  DE: "Germany",
  FR: "France",
};

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  SG: "SGD",
  AE: "AED",
  DE: "EUR",
  FR: "EUR",
};

const INDIA_LOCATIONS = [
  "Bengaluru, Karnataka",
  "Hyderabad, Telangana",
  "Pune, Maharashtra",
  "Chennai, Tamil Nadu",
  "Mumbai, Maharashtra",
  "Gurugram, Haryana",
  "Noida, Uttar Pradesh",
  "Delhi, NCR",
  "Kolkata, West Bengal",
  "Ahmedabad, Gujarat",
];

function safeUpperCountryCode(value?: string | null) {
  if (!value) return "IN";
  const cleaned = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cleaned) ? cleaned : "IN";
}

async function resolveUserCountryCode(): Promise<string> {
  const configuredFallback = safeUpperCountryCode(
    process.env.DASHBOARD_COUNTRY_OVERRIDE || process.env.DEFAULT_COUNTRY_CODE || "IN",
  );

  try {
    const hdrs = await headers();

    const explicit =
      hdrs.get("x-vercel-ip-country") ||
      hdrs.get("cf-ipcountry") ||
      hdrs.get("x-country-code");
    if (explicit) return safeUpperCountryCode(explicit);
  } catch {
    // Ignore header resolution errors and use default fallback.
  }

  return configuredFallback;
}

function normalizeLocationForCountry(
  location: string | undefined,
  countryCode: string,
  index: number,
) {
  const trimmed = (location || "").trim();

  if (countryCode !== "IN") {
    return trimmed || `Major tech hub (${countryCode})`;
  }

  const looksIndian =
    /india|karnataka|maharashtra|telangana|tamil nadu|haryana|ncr|gujarat|west bengal|uttar pradesh/i.test(
      trimmed,
    ) ||
    /bengaluru|bangalore|hyderabad|pune|chennai|mumbai|gurugram|noida|delhi|kolkata|ahmedabad/i.test(
      trimmed,
    );

  if (looksIndian && trimmed) {
    return trimmed;
  }

  return INDIA_LOCATIONS[index % INDIA_LOCATIONS.length];
}

function sanitizeInsights(
  raw: AIInsights,
  industry: string,
  countryCode: string,
): AIInsights {
  const demandLevel = String(raw.demandLevel || "MEDIUM").toUpperCase();
  const marketOutLook = String(raw.marketOutLook || "NEUTRAL").toUpperCase();
  const normalizedCountryCode = safeUpperCountryCode(countryCode);

  const salaryRanges = (Array.isArray(raw.salaryRanges) ? raw.salaryRanges : []).map(
    (range, index) => ({
      role: String(range?.role || `Role ${index + 1}`),
      min: Number(range?.min || 0),
      max: Number(range?.max || 0),
      median: Number(range?.median || 0),
      location: normalizeLocationForCountry(range?.location, normalizedCountryCode, index),
    }),
  );

  return {
    industry,
    salaryRanges,
    growthRate: Number(raw.growthRate || 0),
    demandLevel:
      demandLevel === "HIGH" || demandLevel === "LOW" ? demandLevel : "MEDIUM",
    topSkills: Array.isArray(raw.topSkills) ? raw.topSkills : [],
    marketOutLook:
      marketOutLook === "POSITIVE" || marketOutLook === "NEGATIVE"
        ? marketOutLook
        : "NEUTRAL",
    keyTrends: Array.isArray(raw.keyTrends) ? raw.keyTrends : [],
    recommendedSkills: Array.isArray(raw.recommendedSkills)
      ? raw.recommendedSkills
      : [],
  };
}

export const generateAIinsights = async (
  industry: string,
  countryCode: string,
): Promise<AIInsights> => {
  const normalizedCountryCode = safeUpperCountryCode(countryCode);
  const countryName = COUNTRY_NAMES[normalizedCountryCode] || normalizedCountryCode;
  const currencyCode = COUNTRY_CURRENCY[normalizedCountryCode] || "INR";

  return getCachedData(
    `insights:industry:${industry}:country:${normalizedCountryCode}`,
    async()=>{
      const prompt = `
      Analyze the current state of the ${industry} industry for ${countryName} (${normalizedCountryCode}) and provide insights in ONLY the following JSON format without any additional notes or explanations:
      {
        "industry": "${industry}",
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
      Use ONLY cities/locations within ${countryName} for salaryRanges.location.
      Express salary values in ${currencyCode} thousands per year (example: 1200 means 1,200 ${currencyCode} per year).
      Include at least 5 skills and trends.
    `;

    const result = await model.chat.completions.create({
      model: "gpt-oss:20b-cloud",
      messages: [{ role: "user", content: prompt }],
    });
    const text = result.choices[0]?.message?.content || "";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
  
    const parsed = JSON.parse(cleanedText) as AIInsights;
    return sanitizeInsights(parsed, industry, normalizedCountryCode);
    },CACHE_TTL.WEEK
  )

};

export async function getDashboardInsights() {
  const {userId}=await auth();
  if(!userId) throw new Error("User Not Authorized");
  
  const user=await db.user.findUnique({
    where:{
      clerkUserId:userId
    }
  })
  if(!user) throw new Error("User Not Found");
  if (!user.industry) throw new Error("User industry is not defined");

  const countryCode = await resolveUserCountryCode();
  
  const cacheKey=`dashboard:insights:${user.id}:country:${countryCode}:v3-weekly-geo`
  return getCachedData(
    cacheKey,
    async()=>{
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const insights = await generateAIinsights(user.industry, countryCode);

      return {
        id: `${user.id}-${user.industry}-${countryCode}-weekly`,
        ...insights,
        industry: user.industry,
        lastUpdated: new Date(now),
        nextUpdated: new Date(now + ONE_WEEK_MS),
      };

    },CACHE_TTL.MEDIUM
  )
}