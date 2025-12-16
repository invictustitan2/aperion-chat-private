export interface AiConfig {
  binding: Ai;
  embeddingModel: string;
}

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

/**
 * Generate an embedding for a given text using Workers AI
 */
export async function generateEmbedding(
  ai: Ai,
  text: string,
): Promise<number[]> {
  const response = await ai.run(EMBEDDING_MODEL, {
    text: [text],
  });

  // response is { shape: [1, 768], data: [[...]] } usually
  // The types for @cloudflare/workers-types AI run output can be generic
  // We expect { data: number[][] } for embeddings
  const data = (response as { data: number[][] }).data;
  if (!data || !data[0]) {
    throw new Error("Failed to generate embedding");
  }
  return data[0];
}

/**
 * Workers AI Model Registry
 * Task-based model selection for deterministic behavior and cost optimization
 *
 * Pricing (per million tokens):
 *   - llama-3.1-8b-instruct:          Input: $0.282, Output: $0.827
 *   - llama-3.1-8b-instruct-fp8-fast: Input: $0.045, Output: $0.384 (~6x cheaper)
 * Free tier: 10,000 neurons/day (~400k tokens)
 */
export const AI_MODELS = {
  // Chat: Fast responses for interactive conversations
  chat: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",

  // Reasoning: Higher quality for complex analysis tasks
  reasoning: "@cf/meta/llama-3.1-8b-instruct",

  // Summarization: Balanced for condensing information
  summarization: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",

  // Embeddings: Vector generation for semantic search
  embedding: "@cf/baai/bge-base-en-v1.5",
} as const;

// Cost limits per task type
export const AI_LIMITS = {
  chat: { maxTokens: 512, maxContext: 10 },
  reasoning: { maxTokens: 1024, maxContext: 15 },
  summarization: { maxTokens: 256, maxContext: 20 },
} as const;

export type TaskType = keyof typeof AI_LIMITS;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Generate a chat completion using Workers AI
 * @param taskType - Determines model selection and limits (default: "chat")
 */
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AiToolCall {
  name: string;
  arguments: Record<string, unknown>;
  id?: string;
}

/**
 * Generate a chat completion using Workers AI
 * @param taskType - Determines model selection and limits (default: "chat")
 */
export async function generateChatCompletion(
  ai: Ai,
  messages: ChatMessage[],
  systemPrompt?: string,
  taskType: TaskType = "chat",
  tools?: AiToolDefinition[],
): Promise<{ response: string; tool_calls?: AiToolCall[] }> {
  const limits = AI_LIMITS[taskType];
  const model = taskType === "reasoning" ? AI_MODELS.reasoning : AI_MODELS.chat;

  // Trim messages to context limit for cost efficiency
  const trimmedMessages = messages.slice(-limits.maxContext);

  const fullMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...trimmedMessages]
    : trimmedMessages;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: any = {
    messages: fullMessages,
    max_tokens: limits.maxTokens,
  };

  if (tools && tools.length > 0) {
    input.tools = tools;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await ai.run(model as any, input);

  // Workers AI returns { response: string, tool_calls?: [...] } for function calling models
  const result = response as { response?: string; tool_calls?: AiToolCall[] };

  if (!result.response && !result.tool_calls) {
    throw new Error("Failed to generate chat completion");
  }

  return {
    response: result.response || "",
    tool_calls: result.tool_calls,
  };
}
