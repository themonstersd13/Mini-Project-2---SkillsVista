import { EvidenceType, SWOTCategory } from "@prisma/client";

type ContextSignal = {
  activeGoals: string[];
  recentMessages: string[];
};

export type CandidateSignal = {
  title: string;
  category: SWOTCategory;
  confidence: number;
  reason: string;
  evidenceType: EvidenceType;
  evidenceExcerpt: string;
};

/**
 * Rule-based keyword signal extraction.
 * Used as fallback when LLM-based extraction isn't available.
 */
const KEYWORD_RULES: Array<{ pattern: RegExp; category: SWOTCategory; title: string }> = [
  { pattern: /(finished|completed|delivered|won|improved|consistent|streak)/i, category: SWOTCategory.STRENGTH, title: "Execution consistency" },
  { pattern: /(late|procrastinat|missed|distract|inconsistent|struggling)/i, category: SWOTCategory.WEAKNESS, title: "Time management friction" },
  { pattern: /(internship|hackathon|open source|network|opportunity|mentor|workshop)/i, category: SWOTCategory.OPPORTUNITY, title: "Career growth opportunity" },
  { pattern: /(burnout|stress|overwhelm|backlog|exam pressure|deadline|risk)/i, category: SWOTCategory.THREAT, title: "Sustained stress risk" },
];

export function detectMoodScore(message: string) {
  const positiveHits = (message.match(/(great|good|confident|excited|better|proud|happy|progress|productive)/gi) ?? []).length;
  const negativeHits = (message.match(/(bad|stressed|tired|anxious|overwhelmed|sad|frustrated|stuck|failing)/gi) ?? []).length;
  return Math.max(-5, Math.min(5, positiveHits - negativeHits));
}

export function extractCandidates(message: string, context: ContextSignal): CandidateSignal[] {
  const lowered = message.toLowerCase();
  const evidenceStrength = Math.min(1, 0.35 + (lowered.length > 140 ? 0.2 : 0) + (context.activeGoals.length > 0 ? 0.15 : 0));
  const candidates: CandidateSignal[] = [];

  for (const rule of KEYWORD_RULES) {
    if (!rule.pattern.test(message)) {
      continue;
    }

    const confidenceBase = rule.category === SWOTCategory.STRENGTH || rule.category === SWOTCategory.WEAKNESS ? 0.64 : 0.58;
    const confidence = Math.min(0.95, confidenceBase + evidenceStrength * 0.25);

    candidates.push({
      title: rule.title,
      category: rule.category,
      confidence,
      reason: `Detected repeated signal: ${rule.title.toLowerCase()}`,
      evidenceType: context.activeGoals.length > 0 ? EvidenceType.TASK_BASED : EvidenceType.SELF_REPORTED,
      evidenceExcerpt: message.slice(0, 280),
    });
  }

  return candidates;
}

/**
 * Generate a rule-based fallback reply (used when all LLM providers fail).
 */
export function generateAssistantReply(args: {
  message: string;
  moodScore: number;
  activeGoals: string[];
  updates: Array<{ title: string; status: string; reason: string }>;
}) {
  const checkInPrompt = args.activeGoals.length
    ? `Quick check-in: how did you move your goal "${args.activeGoals[0]}" today?`
    : "Quick check-in: what is one task you can complete before tomorrow?";

  const moodNote =
    args.moodScore <= -2
      ? "I notice a short-term low mood signal. I will treat it as temporary unless it repeats over time."
      : args.moodScore >= 2
        ? "Your message shows positive momentum. I still validate this against sustained patterns."
        : "Your update looks neutral today, which helps avoid overreacting to single-day changes.";

  const updateLines = args.updates.length
    ? args.updates
        .map((update) => `- ${update.title}: ${update.status.toLowerCase()} (${update.reason})`)
        .join("\n")
    : "- No SWOT mutation this turn because evidence confidence was below threshold.";

  return `${moodNote}\n\n${checkInPrompt}\n\nWhat changed in SWOT and why:\n${updateLines}`;
}
