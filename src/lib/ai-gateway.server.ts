import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiGatewayProvider(options: {
  openRouterApiKey?: string;
  openRouterBaseURL?: string;
  groqApiKey?: string;
}) {
  if (options.openRouterApiKey) {
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: options.openRouterBaseURL ?? "https://openrouter.ai/api/v1",
        apiKey: options.openRouterApiKey,
      });
  }

  if (options.groqApiKey) {
    return createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: options.groqApiKey,
    });
  }

  throw new Error(
    "No AI gateway API key configured. Provide OPENROUTER_API_KEY or GROQ_API_KEY/LOVABLE_API_KEY.",
  );
}
