import OpenAI from "openai";

const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";

export const model = new OpenAI({
  apiKey: ollamaApiKey,
  baseURL: ollamaBaseUrl,
});

export const MODEL_NAME = "gpt-oss:20b-cloud";

// ============================================
// AI CAREER AGENT - Central Intelligence
// ============================================

export interface CareerProfile {
  industry: string | null;
  experience: number | null;
  skills: string[];
  bio: string | null;
  targetRole?: string;
  careerGoals?: string[];
}

export interface AIRecommendation {
  type: "skill" | "course" | "job" | "interview" | "networking" | "certification";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  reasoning: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CareerInsight {
  skillGaps: { skill: string; importance: number; learnedVia?: string }[];
  marketTrends: { trend: string; impact: "positive" | "negative" | "neutral"; description: string }[];
  recommendedActions: AIRecommendation[];
  careerPathSuggestions: { role: string; matchScore: number; skillsNeeded: string[] }[];
}

/**
 * Main AI Career Agent - Analyzes user profile and provides personalized recommendations
 */
export async function analyzeCareerProfile(
  profile: CareerProfile,
  context: {
    recentActivity?: string;
    completedCourses?: string[];
    weakAreas?: string[];
  } = {}
): Promise<CareerInsight> {
  try {
    const prompt = `
You are an expert AI career advisor analyzing a professional's profile to provide actionable recommendations.

PROFESSIONAL PROFILE:
- Industry: ${profile.industry || "Not specified"}
- Experience: ${profile.experience || 0} years
- Skills: ${profile.skills.join(", ") || "Not specified"}
- Bio: ${profile.bio || "Not specified"}
- Target Role: ${profile.targetRole || "Career advancement"}

CONTEXT:
- Recent Activity: ${context.recentActivity || "None"}
- Completed Courses: ${context.completedCourses?.join(", ") || "None"}
- Identified Weak Areas: ${context.weakAreas?.join(", ") || "None"}

Analyze this profile and provide:

1. SKILL GAPS (3-5 skills they need to develop, with importance 1-10)
2. MARKET TRENDS (2-3 trends affecting their industry)
3. RECOMMENDED ACTIONS (5 specific, actionable recommendations)
4. CAREER PATH SUGGESTIONS (3 potential career trajectories)

Return ONLY valid JSON in this format:
{
  "skillGaps": [
    { "skill": "skill name", "importance": 8, "learnedVia": "suggested learning method" }
  ],
  "marketTrends": [
    { "trend": "trend name", "impact": "positive", "description": "description" }
  ],
  "recommendedActions": [
    { "type": "skill", "title": "action title", "description": "details", "priority": "high", "reasoning": "why" }
  ],
  "careerPathSuggestions": [
    { "role": "role name", "matchScore": 85, "skillsNeeded": ["skill1", "skill2"] }
  ]
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    const parsed = JSON.parse(cleanedText) as CareerInsight;

    return parsed;
  } catch (error) {
    console.error("Error analyzing career profile:", error);
    return {
      skillGaps: [],
      marketTrends: [],
      recommendedActions: [],
      careerPathSuggestions: [],
    };
  }
}

// ============================================
// SKILL GAP ANALYZER AGENT
// ============================================

export async function analyzeSkillGaps(
  currentSkills: string[],
  targetRole: string,
  industry: string
): Promise<{ gaps: string[]; learningResources: string[] }> {
  try {
    const prompt = `
As a skills gap analyst, compare current skills with target role requirements.

Current Skills: ${currentSkills.join(", ")}
Target Role: ${targetRole}
Industry: ${industry}

Identify:
1. Missing critical skills (3-5)
2. Suggested learning resources for each gap

Return JSON:
{
  "gaps": ["skill1", "skill2"],
  "learningResources": ["resource for skill1", "resource for skill2"]
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error analyzing skill gaps:", error);
    return { gaps: [], learningResources: [] };
  }
}

// ============================================
// INTERVIEW COACH AGENT
// ============================================

export async function generatePersonalizedInterviewQuiz(
  industry: string,
  skills: string[],
  weakTopics: string[] = [],
  targetRole?: string
): Promise<Array<{
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}>> {
  try {
    const focusAreas = weakTopics.length > 0
      ? `Focus especially on: ${weakTopics.join(", ")}`
      : "Cover a balanced range of topics";

    const prompt = `
Generate 10 technical interview questions for a ${industry} professional.
Target Role: ${targetRole || "general position"}
Key Skills: ${skills.join(", ")}
${focusAreas}

Each question should:
- Be realistic for actual interviews
- Have 4 plausible options
- Include a detailed explanation
- Vary in difficulty (3 easy, 5 medium, 2 hard)
- Include the topic category

Return JSON array:
[
  {
    "question": "...",
    "options": ["a", "b", "c", "d"],
    "correctAnswer": "...",
    "explanation": "...",
    "topic": "topic category",
    "difficulty": "medium"
  }
]
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const text = result.choices[0]?.message?.content?.trim() || "[]";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating interview quiz:", error);
    return [];
  }
}

// ============================================
// RESUME OPTIMIZER AGENT
// ============================================

export async function optimizeResumeSection(
  section: string,
  content: string,
  industry: string,
  targetJob?: string
): Promise<{ optimized: string; suggestions: string[]; atsScore: number }> {
  try {
    const prompt = `
As an expert resume optimizer, improve this resume section for a ${industry} professional.
${targetJob ? `Target Job: ${targetJob}` : ""}

Section: ${section}
Current Content:
${content}

Provide:
1. Optimized version (impactful, quantifiable, ATS-friendly)
2. 3 specific suggestions for further improvement
3. ATS compatibility score (0-100)

Return JSON:
{
  "optimized": "improved content",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "atsScore": 85
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error optimizing resume:", error);
    return { optimized: content, suggestions: [], atsScore: 50 };
  }
}

// ============================================
// LEARNING PATH RECOMMENDER AGENT
// ============================================

export async function recommendLearningPath(
  currentSkills: string[],
  careerGoal: string,
  availableHoursPerWeek: number,
  timeline: "1 month" | "3 months" | "6 months" | "1 year"
): Promise<{
  pathName: string;
  weeklyPlan: { week: number; focus: string; goals: string[] }[];
  resources: { title: string; type: string; url?: string }[];
  milestones: { week: number; achievement: string }[];
}> {
  try {
    const prompt = `
Create a personalized learning path for career advancement.

Current Skills: ${currentSkills.join(", ")}
Career Goal: ${careerGoal}
Time Available: ${availableHoursPerWeek} hours/week
Timeline: ${timeline}

Create:
1. A named learning path
2. Week-by-week plan with focus areas and goals
3. Recommended resources (courses, books, projects)
4. Key milestones to track progress

Return JSON:
{
  "pathName": "Full-Stack Developer Career Path",
  "weeklyPlan": [
    { "week": 1, "focus": "Topic", "goals": ["goal 1", "goal 2"] }
  ],
  "resources": [
    { "title": "Resource Name", "type": "course|book|project", "url": "optional" }
  ],
  "milestones": [
    { "week": 4, "achievement": "Complete first project" }
  ]
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error recommending learning path:", error);
    return {
      pathName: "Career Advancement Path",
      weeklyPlan: [],
      resources: [],
      milestones: [],
    };
  }
}

// ============================================
// COVER LETTER GENERATOR AGENT
// ============================================

export async function generateCoverLetter(
  user: { name: string; skills: string[]; experience: number; bio: string },
  jobDescription: string,
  company: string,
  tone: "professional" | "enthusiastic" | "confident" = "professional"
): Promise<{ content: string; highlights: string[]; suggestions: string[] }> {
  try {
    const prompt = `
Write a compelling cover letter for a ${tone} applicant.

APPLICANT:
- Name: ${user.name}
- Skills: ${user.skills.join(", ")}
- Experience: ${user.experience} years
- Background: ${user.bio}

JOB:
- Company: ${company}
- Description: ${jobDescription}

Write:
1. A personalized cover letter (300-400 words)
2. Highlight 3 key strengths that match the job
3. Provide 2 suggestions for customization

Return JSON:
{
  "content": "Dear Hiring Manager...",
  "highlights": ["strength 1", "strength 2", "strength 3"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return { content: "", highlights: [], suggestions: [] };
  }
}

// ============================================
// JOB MATCH SCORER AGENT
// ============================================

export async function scoreJobMatch(
  userSkills: string[],
  userExperience: number,
  jobDescription: string
): Promise<{
  overallScore: number;
  skillMatch: { matched: string[]; missing: string[] };
  experienceMatch: boolean;
  recommendations: string[];
}> {
  try {
    const prompt = `
Analyze job fit for a candidate.

CANDIDATE:
- Skills: ${userSkills.join(", ")}
- Experience: ${userExperience} years

JOB DESCRIPTION:
${jobDescription}

Analyze:
1. Overall match score (0-100)
2. Skill match (matched and missing skills)
3. Experience fit
4. Recommendations to improve candidacy

Return JSON:
{
  "overallScore": 75,
  "skillMatch": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill3", "skill4"]
  },
  "experienceMatch": true,
  "recommendations": ["recommendation 1", "recommendation 2"]
}
`;

    const result = await model.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content?.trim() || "{}";
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error scoring job match:", error);
    return {
      overallScore: 50,
      skillMatch: { matched: [], missing: [] },
      experienceMatch: false,
      recommendations: [],
    };
  }
}
