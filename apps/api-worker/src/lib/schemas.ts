import { z } from "zod";

export const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  model: z.enum(["workers-ai", "gemini"]).optional(),
});

export const EpisodicRequestSchema = z.object({
  content: z.string().min(1),
  provenance: z.object({
    source_type: z.enum(["user", "system", "model", "external"]),
    source_id: z.string(),
    timestamp: z.number(),
    confidence: z.number().optional(),
    explicit_confirm: z.boolean().optional(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SemanticRequestSchema = z.object({
  content: z.string().min(1),
  references: z.array(z.string()),
  provenance: z.object({
    source_type: z.enum(["user", "system", "model", "external"]),
    source_id: z.string(),
    timestamp: z.number(),
    confidence: z.number().optional(),
    explicit_confirm: z.boolean().optional(),
  }),
  policyContext: z.record(z.string(), z.unknown()).optional(),
  embedding: z.array(z.number()).optional(),
});

export const IdentityUpsertSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  provenance: z.object({
    source_type: z.enum(["user", "system", "model", "external"]),
    source_id: z.string(),
    timestamp: z.number(),
    confidence: z.number().optional(),
  }),
  explicit_confirm: z.boolean().optional(),
  preferred_tone: z.string().optional(),
  memory_retention_days: z.number().optional(),
  interface_theme: z.string().optional(),
});

export const SemanticSummarizeSchema = z.object({
  contents: z.array(z.string()).min(1),
  query: z.string().optional(),
});
