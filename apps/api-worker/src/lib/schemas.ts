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
  conversation_id: z.string().optional(),
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
  conversation_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
});

export const EpisodicUpdateSchema = z
  .object({
    content: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
  })
  .refine(
    (v) =>
      v.content !== undefined ||
      v.tags !== undefined ||
      v.importance !== undefined,
    {
      message: "Must provide at least one field to update",
    },
  );

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

export const KnowledgePromoteSchema = z.object({
  semantic_id: z.string().min(1),
});

export const InsightsSummarySchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(20).optional(),
});

export const RelationshipKindSchema = z.enum([
  "episodic",
  "semantic",
  "knowledge",
  "policy",
]);

export const RelationshipTypeSchema = z.enum([
  "EVIDENCE_FOR",
  "INTERPRETS",
  "REFINES",
  "CONFLICTS_WITH",
  "SUPERSEDES",
]);

export const RelationshipListQuerySchema = z.object({
  kind: RelationshipKindSchema,
  id: z.string().min(1),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v > 0), {
      message: "limit must be a positive number",
    })
    .transform((v) => (v === undefined ? 50 : v)),
  since: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), {
      message: "since must be a non-negative number",
    })
    .transform((v) => (v === undefined ? 0 : v)),
});

export const RelationshipCreateSchema = z.object({
  type: RelationshipTypeSchema,
  from_kind: RelationshipKindSchema,
  from_id: z.string().min(1),
  to_kind: RelationshipKindSchema,
  to_id: z.string().min(1),
  rationale: z.string().min(1),
  created_by: z.enum(["user", "system"]).optional().default("user"),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string()).optional(),
});
