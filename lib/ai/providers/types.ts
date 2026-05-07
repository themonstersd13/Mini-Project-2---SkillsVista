/**
 * Provider interface that all LLM providers must implement.
 */
export type LLMProvider = {
  name: string;
  call(systemPrompt: string, userPrompt: string): Promise<string | null>;
};

/**
 * Provider configuration.
 */
export type ProviderConfig = {
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
};

export const DEFAULT_CONFIG: ProviderConfig = {
  timeoutMs: 15000,
  maxOutputTokens: 2048,
  temperature: 0.4,
};
