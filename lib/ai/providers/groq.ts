import type { LLMProvider } from "./types";
import { DEFAULT_CONFIG } from "./types";

export function createGroqProvider(): LLMProvider {
  return {
    name: "groq",
    async call(systemPrompt: string, userPrompt: string): Promise<string | null> {
      const apiKey = process.env.GROQ_API_KEY;
      const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
      if (!apiKey) {
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        DEFAULT_CONFIG.timeoutMs,
      );

      try {
        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              temperature: DEFAULT_CONFIG.temperature,
              max_tokens: DEFAULT_CONFIG.maxOutputTokens,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          console.warn(`Groq API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        return data.choices?.[0]?.message?.content?.trim() ?? null;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn("Groq request timed out");
        } else {
          console.warn("Groq error:", error);
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
