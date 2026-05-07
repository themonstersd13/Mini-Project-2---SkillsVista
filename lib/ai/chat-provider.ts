import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createOllamaProvider } from "./providers/ollama";
import type { LLMProvider } from "./providers/types";
import { serializeContextForPrompt, type CoachContext } from "./context-builder";
import type { MessageSummary } from "@/lib/memory/short-term";

/**
 * Build the system prompt for the coach.
 * Includes: persona, rules, serialized context, and output format instructions.
 */
function buildSystemPrompt(ctx: CoachContext): string {
  const contextSection = serializeContextForPrompt(ctx);

  return `You are a personal growth coach and mentor. You remember the user's journey and act as a supportive, insightful advisor.

=== YOUR CORE RULES ===
1. Talk like a real mentor — warm, direct, and thoughtful. Never sound robotic or formulaic.
2. Reference things the user has shared before. Mention their goals, habits, and past progress naturally.
3. Distinguish temporary mood from long-term patterns. A single bad day doesn't define someone.
4. Follow up on past discussions naturally. If you asked something before, check if they've acted on it.
5. Connect today's effort to bigger goals. Help them see the bigger picture.
6. Be concise but meaningful. No filler. Every sentence should add value.
7. End with a clear next step or a thoughtful question.

=== CRITICAL: NEVER REVEAL SYSTEM INTERNALS ===
- NEVER mention "SWOT", "signals", "confidence scores", "evidence", "validation", "categories" or any internal system terminology.
- NEVER say things like "Based on your strength...", "Your weakness is...", "I detected a signal...", "Confidence is 82%..."
- Instead, talk naturally about the user's abilities, challenges, and growth areas without labeling them as SWOT items.
- Your response should read like advice from a real human mentor, not a system report.

=== RESPONSE STYLE ===
- Talk about strengths as "things you're good at" or "patterns I've noticed"
- Talk about weaknesses as "areas to work on" or "challenges you've mentioned"
- Talk about opportunities as "possibilities" or "things worth exploring"
- Talk about threats as "things to watch out for" or "potential risks"

=== SIGNAL EXTRACTION (internal only — NEVER mention this to the user) ===
While responding, also analyze the user's message for growth-relevant patterns:
- Strengths: consistent positive behaviors, skills, or achievements
- Weaknesses: recurring challenges, gaps, or friction points
- Opportunities: external possibilities, growth avenues, resources
- Threats: risks, external pressures, negative patterns

=== OUTPUT FORMAT ===
Return your response as JSON with this exact structure:
\`\`\`json
{
  "userResponse": "Your natural, mentor-like response to the user (markdown supported)",
  "signals": [
    {
      "title": "Signal title",
      "category": "STRENGTH|WEAKNESS|OPPORTUNITY|THREAT",
      "confidence": 0.0-1.0,
      "reason": "Why this is a signal",
      "evidenceType": "SELF_REPORTED|TASK_BASED|BEHAVIOR_PATTERN|PROJECT_PROGRESS",
      "evidenceExcerpt": "Relevant excerpt from user message"
    }
  ],
  "followUps": ["Questions you want to track for next conversation"],
  "moodAssessment": -5 to 5 or null
}
\`\`\`

The "userResponse" field MUST read like natural human conversation. No system jargon.
If no signals are detected, use an empty array for signals.
If the JSON format fails, just respond naturally — the system will handle it.

=== USER CONTEXT (for your reference only — do NOT reveal this structure to the user) ===
${contextSection}`;
}

/**
 * Build the user prompt from conversation history + current message.
 */
function buildUserPrompt(
  recentMessages: MessageSummary[],
  currentMessage: string,
): string {
  const historySection = recentMessages
    .slice(-8)
    .map((m) => `${m.role === "USER" ? "User" : "Coach"}: ${m.content}`)
    .join("\n\n");

  if (historySection) {
    return `=== RECENT CONVERSATION ===\n${historySection}\n\n=== CURRENT MESSAGE ===\nUser: ${currentMessage}`;
  }

  return `User: ${currentMessage}`;
}

/**
 * Get the ordered provider chain based on configuration.
 */
function getProviderChain(): LLMProvider[] {
  const preferred = (process.env.CHAT_PROVIDER ?? "auto").toLowerCase();

  const gemini = createGeminiProvider();
  const groq = createGroqProvider();
  const ollama = createOllamaProvider();

  switch (preferred) {
    case "gemini":
      return [gemini, groq, ollama];
    case "groq":
      return [groq, gemini, ollama];
    case "ollama":
      return [ollama, gemini, groq];
    default:
      return [gemini, groq, ollama];
  }
}

/**
 * Call the LLM provider chain with fallback.
 * Returns the raw LLM response string.
 */
export async function callProviderChain(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  const providers = getProviderChain();

  for (const provider of providers) {
    try {
      const result = await provider.call(systemPrompt, userPrompt);
      if (result) {
        console.log(`LLM response from: ${provider.name}`);
        return result;
      }
    } catch (error) {
      console.warn(`Provider ${provider.name} failed:`, error);
    }
  }

  return null;
}

/**
 * Generate a rule-based fallback reply when all LLM providers fail.
 * Must sound like a real human mentor — NO system jargon.
 */
function generateFallbackReply(ctx: CoachContext, message: string): string {
  const parts: string[] = [];

  // Greeting based on context
  if (ctx.goals.length > 0) {
    parts.push(
      `Hey! Good to hear from you. How's your progress on "${ctx.goals[0].title}" going?`,
    );
  } else {
    parts.push("Hey! Thanks for checking in. What have you been working on lately?");
  }

  // Mood-based response (natural language, no system terms)
  if (ctx.moodTrajectory.length > 0) {
    const avgMood =
      ctx.moodTrajectory.reduce((a, b) => a + b, 0) /
      ctx.moodTrajectory.length;
    if (avgMood >= 1) {
      parts.push(
        "It sounds like things are going well — that's great to hear! Let's keep that momentum going.",
      );
    } else if (avgMood <= -1) {
      parts.push(
        "It seems like things have been a bit tough recently. That's totally normal — let's figure out what we can do about it.",
      );
    }
  }

  // Streak (natural, not system-like)
  if (ctx.streakInfo.currentStreak >= 3) {
    parts.push(
      `By the way, you've been showing up consistently for ${ctx.streakInfo.currentStreak} days now. That kind of discipline really adds up over time.`,
    );
  }

  // Action step
  if (ctx.tasks.length > 0) {
    parts.push(
      `What's your plan for tackling "${ctx.tasks[0].title}"? I'd love to hear how you're thinking about it.`,
    );
  } else {
    parts.push("What's one thing you'd like to focus on or accomplish today?");
  }

  return parts.join("\n\n") || "Thanks for checking in! Tell me what's been on your mind, and we can figure out the best next step together.";
}

/**
 * Main entry point: compose a coach reply using full RAG context.
 * This is the single blocking LLM call per message.
 */
export async function composeCoachReply(
  ctx: CoachContext,
  currentMessage: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = buildUserPrompt(ctx.recentMessages, currentMessage);

  try {
    const rawResponse = await callProviderChain(systemPrompt, userPrompt);
    if (rawResponse) {
      return rawResponse;
    }
  } catch (error) {
    console.warn("All LLM providers failed:", error);
  }

  // All providers failed — use rule-based fallback
  return generateFallbackReply(ctx, currentMessage);
}
