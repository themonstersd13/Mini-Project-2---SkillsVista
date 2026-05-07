import type { SWOTCategory, EvidenceType } from "@prisma/client";

export type CandidateSignal = {
  title: string;
  category: SWOTCategory;
  confidence: number;
  reason: string;
  evidenceType: EvidenceType;
  evidenceExcerpt: string;
};

export type StructuredResponse = {
  userResponse: string;
  signals: CandidateSignal[];
  followUps: string[];
  moodAssessment: number | null;
};

/**
 * Parse the LLM's structured JSON output into a typed response.
 * This parser is resilient — it tries multiple extraction strategies
 * and NEVER leaks raw JSON to the user.
 */
export function parseStructuredResponse(raw: string): StructuredResponse {
  // Strategy 1: Extract from ```json code block
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    const result = tryParseJson(jsonMatch[1]);
    if (result) return result;
  }

  // Strategy 2: Find the outermost JSON object with "userResponse"
  const plainJsonMatch = raw.match(/\{[\s\S]*"userResponse"[\s\S]*\}/);
  if (plainJsonMatch) {
    const result = tryParseJson(plainJsonMatch[0]);
    if (result) return result;
  }

  // Strategy 3: Try to extract just the userResponse value with regex
  // This handles cases where the JSON is partially malformed
  const userResponseMatch = raw.match(
    /"userResponse"\s*:\s*"((?:[^"\\]|\\.)*)"/,
  );
  if (userResponseMatch) {
    const extracted = userResponseMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

    if (extracted.length > 10) {
      // Also try to extract signals from the same raw text
      const signalsMatch = raw.match(/"signals"\s*:\s*(\[[\s\S]*?\])/);
      let signals: CandidateSignal[] = [];
      if (signalsMatch) {
        try {
          const parsed = JSON.parse(signalsMatch[1]) as unknown[];
          signals = parseSignalsArray(parsed);
        } catch {
          // ignore malformed signals
        }
      }

      return {
        userResponse: extracted,
        signals,
        followUps: [],
        moodAssessment: null,
      };
    }
  }

  // Strategy 4: Strip ALL JSON artifacts and return clean text
  // This is the last resort — ensures the user NEVER sees raw JSON
  const cleaned = raw
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove JSON-like structures
    .replace(/\{[\s\S]*\}/g, "")
    // Remove leftover brackets
    .replace(/[\[\]{}]/g, "")
    // Remove JSON keys
    .replace(/"(?:userResponse|signals|followUps|moodAssessment|title|category|confidence|reason|evidenceType|evidenceExcerpt)"\s*:/g, "")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // If cleaning removed everything, use a generic response
  if (cleaned.length < 10) {
    return {
      userResponse:
        "Thanks for sharing that! I'd love to hear more about what you've been working on. What's been on your mind lately?",
      signals: [],
      followUps: [],
      moodAssessment: null,
    };
  }

  return {
    userResponse: cleaned,
    signals: [],
    followUps: [],
    moodAssessment: null,
  };
}

function tryParseJson(jsonStr: string): StructuredResponse | null {
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof parsed.userResponse === "string" && parsed.userResponse.length > 0) {
      return {
        userResponse: parsed.userResponse,
        signals: parseSignalsArray(parsed.signals),
        followUps: parseStringArray(parsed.followUps),
        moodAssessment:
          typeof parsed.moodAssessment === "number"
            ? parsed.moodAssessment
            : null,
      };
    }
  } catch {
    // JSON parsing failed
  }
  return null;
}

function parseSignalsArray(raw: unknown): CandidateSignal[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      title: String(item.title ?? "Unknown signal"),
      category: validateCategory(item.category),
      confidence:
        typeof item.confidence === "number"
          ? Math.max(0, Math.min(1, item.confidence))
          : 0.5,
      reason: String(item.reason ?? ""),
      evidenceType: validateEvidenceType(item.evidenceType),
      evidenceExcerpt: String(item.evidenceExcerpt ?? ""),
    }));
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === "string");
}

function validateCategory(raw: unknown): SWOTCategory {
  const valid = ["STRENGTH", "WEAKNESS", "OPPORTUNITY", "THREAT"];
  const value = String(raw ?? "").toUpperCase();
  return valid.includes(value) ? (value as SWOTCategory) : "WEAKNESS";
}

function validateEvidenceType(raw: unknown): EvidenceType {
  const valid = [
    "SELF_REPORTED",
    "TASK_BASED",
    "MENTOR_FEEDBACK",
    "PROJECT_PROGRESS",
    "BEHAVIOR_PATTERN",
    "ASSESSMENT",
  ];
  const value = String(raw ?? "").toUpperCase();
  return valid.includes(value) ? (value as EvidenceType) : "SELF_REPORTED";
}
