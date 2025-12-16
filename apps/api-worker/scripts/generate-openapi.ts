import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

extendZodWithOpenApi(z);

async function generate() {
  const registry = new OpenAPIRegistry();

  const {
    ChatRequestSchema,
    EpisodicRequestSchema,
    IdentityUpsertSchema,
    SemanticRequestSchema,
    SemanticSummarizeSchema,
  } = await import("../src/lib/schemas");

  // Register Schemas
  registry.register("ChatRequest", ChatRequestSchema);
  registry.register("EpisodicRequest", EpisodicRequestSchema);
  registry.register("SemanticRequest", SemanticRequestSchema);
  registry.register("IdentityUpsert", IdentityUpsertSchema);
  registry.register("SemanticSummarize", SemanticSummarizeSchema);

  // Define Bearer Auth
  const bearerAuth = registry.registerComponent(
    "securitySchemes",
    "BearerAuth",
    {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT", // or plain token
    },
  );

  // Paths
  registry.registerPath({
    method: "post",
    path: "/v1/chat",
    summary: "Chat Completion",
    security: [{ [bearerAuth.name]: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: ChatRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string(),
              response: z.string(),
              timestamp: z.number(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/episodic",
    summary: "Create Episodic Memory",
    security: [{ [bearerAuth.name]: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: EpisodicRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Memory created",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), id: z.string() }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/semantic",
    summary: "Create Semantic Memory",
    security: [{ [bearerAuth.name]: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: SemanticRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Memory created",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), id: z.string() }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/v1/identity",
    summary: "Upsert Identity",
    security: [{ [bearerAuth.name]: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: IdentityUpsertSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Identity updated",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), id: z.string() }),
          },
        },
      },
    },
  });

  // Generate
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const docs = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Aperion Chat Private API",
      description: "API Reference for Aperion Chat Private",
    },
    servers: [{ url: "https://api.aperion.cc" }],
  });

  const outputPath = path.resolve(__dirname, "../../../docs/openapi.json");
  fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2));
  console.log(`OpenAPI spec generated at ${outputPath}`);
}

generate().catch(console.error);
