import { IdentityService } from "../services/IdentityService";
import { SemanticService } from "../services/SemanticService";
import { Env } from "../types";

export const TOOLS = [
  {
    name: "search_memory",
    description: "Search the semantic memory for relevant past information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant memories.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "update_identity",
    description: "Update a user preference or identity attribute.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "The key of the attribute (e.g., 'preferred_tone', 'favorite_color').",
        },
        value: {
          type: "string",
          description: "The value to set.",
        },
      },
      required: ["key", "value"],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
): Promise<string> {
  switch (name) {
    case "search_memory": {
      const semanticService = new SemanticService(env);
      const results = await semanticService.search(args.query);
      return JSON.stringify(results.map((r) => r.content));
    }
    case "update_identity": {
      const identityService = new IdentityService(env);
      await identityService.upsert({
        key: args.key,
        value: args.value,
        provenance: {
          source_type: "model", // It's the assistant updating it based on user interaction
          source_id: "aperion-tool-use",
          timestamp: Date.now(),
          confidence: 1.0,
        },
      });
      return `Successfully updated ${args.key} to ${args.value}`;
    }
    default:
      return "Tool not found";
  }
}
