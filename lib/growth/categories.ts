/**
 * Canonical taxonomy for user-growth activity.
 *
 * Assessment.category is a free-text column, and performance intelligence
 * filters on it with substring matching. Centralizing the strings here keeps
 * writers and readers in sync so a typo can't silently break the dashboard
 * metrics. Always write categories via ASSESSMENT_CATEGORY and match with the
 * matchesCategory helpers.
 */

export const ASSESSMENT_CATEGORY = {
  /** Technical interview quizzes (actions/interview.ts, topic quizzes). */
  TECHNICAL: "Technical",
  /** Voice/text mock interview simulations (interview-simulator/finish). */
  INTERVIEW_SIMULATION: "Interview Simulation",
  /** Academy scenario simulations (academy/simulations submit). */
  ACADEMY_SIMULATION: "Academy Simulation",
  /** Topic-focused practice quizzes (actions/topicQuiz.ts). */
  TOPIC_QUIZ: "Topic Quiz",
} as const;

export type AssessmentCategory =
  (typeof ASSESSMENT_CATEGORY)[keyof typeof ASSESSMENT_CATEGORY];

/**
 * Substring tokens (lowercased) that classify a stored category into the
 * "technical quiz" performance bucket. Kept permissive for back-compat with
 * historical rows written before this taxonomy existed.
 */
const TECHNICAL_TOKENS = ["technical", "quiz"];

/**
 * Tokens that classify a stored category into the "interview/simulation"
 * performance bucket (mock interviews + academy simulations both count as
 * interview-readiness signals).
 */
const INTERVIEW_TOKENS = ["interview simulation", "academy simulation", "simulation"];

export function isTechnicalCategory(category: string): boolean {
  const c = category.toLowerCase();
  return TECHNICAL_TOKENS.some((t) => c.includes(t));
}

export function isInterviewCategory(category: string): boolean {
  const c = category.toLowerCase();
  return INTERVIEW_TOKENS.some((t) => c.includes(t));
}
