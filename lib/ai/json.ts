/**
 * Shared helpers for parsing LLM output.
 *
 * Small models (e.g. openai/gpt-oss-20b) frequently wrap JSON in markdown fences,
 * add a conversational preamble ("Here's the JSON:"), or emit trailing notes.
 * These helpers tolerate all of that and NEVER throw — callers always get a
 * usable value or an explicit fallback, so a bad model response degrades
 * gracefully instead of crashing a route or poisoning the cache.
 */

/** Strip markdown code fences and a leading conversational preamble line. */
function stripFencesAndPreamble(value: string): string {
  let text = (value || "").trim();

  // Remove ```json ... ``` / ``` ... ``` fences
  text = text.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();

  // Drop a single leading preamble line like "Here's the JSON:" / "Sure, ...:"
  text = text.replace(
    /^\s*(?:sure|certainly|here(?:'s| is)|below is|okay|here you go)\b[^\n{[]*[:\-]\s*\n*/i,
    ""
  );

  return text.trim();
}

/** Parse JSON, returning null instead of throwing. */
export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Extract a single JSON object from arbitrary LLM text.
 * Tries a direct parse first, then falls back to slicing the outermost { ... }.
 */
export function extractJsonObject(value: string): Record<string, unknown> | null {
  const cleaned = stripFencesAndPreamble(value);

  const direct = safeJsonParse(cleaned);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const parsed = safeJsonParse(cleaned.slice(start, end + 1));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/**
 * Extract a JSON array from arbitrary LLM text.
 * Tries a direct parse first, then falls back to slicing the outermost [ ... ].
 */
export function extractJsonArray(value: string): unknown[] {
  const cleaned = stripFencesAndPreamble(value);

  const direct = safeJsonParse(cleaned);
  if (Array.isArray(direct)) {
    return direct;
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const parsed = safeJsonParse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Generic, never-throws parse for LLM output.
 * Returns the parsed value (object or array) or the provided fallback.
 *
 * @example
 *   const skills = parseLLMJson<Skill[]>(text, []);
 *   const insight = parseLLMJson<Insight>(text, EMPTY_INSIGHT);
 */
export function parseLLMJson<T>(value: string, fallback: T): T {
  const cleaned = stripFencesAndPreamble(value);

  // Decide whether the payload looks like an array or an object.
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const looksLikeArray =
    firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);

  if (looksLikeArray) {
    const arr = extractJsonArray(cleaned);
    return arr.length > 0 || Array.isArray(fallback) ? (arr as unknown as T) : fallback;
  }

  const obj = extractJsonObject(cleaned);
  return obj ? (obj as unknown as T) : fallback;
}
