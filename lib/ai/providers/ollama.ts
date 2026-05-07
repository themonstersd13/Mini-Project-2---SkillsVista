import type { LLMProvider } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Local Ollama provider for Llama 3.1.
 * Requires Ollama running on localhost:11434.
 * Gracefully returns null if Ollama isn't available.
 */
export function createOllamaProvider(): LLMProvider {
  return {
    name: "ollama",
    async call(systemPrompt: string, userPrompt: string): Promise<string | null> {
      const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL ?? "llama3.1";

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        DEFAULT_CONFIG.timeoutMs,
      );

      try {
        const response = await fetch(`${host}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            options: {
              temperature: DEFAULT_CONFIG.temperature,
              num_predict: DEFAULT_CONFIG.maxOutputTokens,
            },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(`Ollama API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as {
          message?: { content?: string };
        };

        return data.message?.content?.trim() ?? null;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn("Ollama request timed out");
        } else {
          // Ollama likely not running — this is expected fallback behavior
          console.warn("Ollama unavailable (expected if not installed)");
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
