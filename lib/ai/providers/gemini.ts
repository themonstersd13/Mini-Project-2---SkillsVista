import type { LLMProvider } from "./types";
import { DEFAULT_CONFIG } from "./types";

export function createGeminiProvider(): LLMProvider {
  return {
    name: "gemini",
    async call(systemPrompt: string, userPrompt: string): Promise<string | null> {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: DEFAULT_CONFIG.temperature,
                maxOutputTokens: DEFAULT_CONFIG.maxOutputTokens,
              },
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          console.warn(`Gemini API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn("Gemini request timed out");
        } else {
          console.warn("Gemini error:", error);
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
