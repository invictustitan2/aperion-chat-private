import { IRequest } from "itty-router";
import { Env } from "../types";

interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMs: number; // Window duration in milliseconds
}

// Rate limit configurations per endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
  voice: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  default: { maxRequests: 60, windowMs: 60000 }, // 60 requests per minute
};

/**
 * Simple in-memory rate limiter using Cloudflare KV or D1
 * For production, consider using Cloudflare Rate Limiting product
 */
export async function withRateLimit(
  request: IRequest,
  env: Env,
  endpointType: keyof typeof RATE_LIMITS = "default",
): Promise<Response | null> {
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;

  // Get client identifier (IP address from CF headers)
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  // Create a unique key for this client + endpoint
  const rateLimitKey = `rate:${endpointType}:${clientIp}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Using D1 for rate limit tracking (simple approach)
    // For high traffic, use Cloudflare Rate Limiting or Workers KV with expiration

    // Check if rate limit table exists, create if not
    await env.MEMORY_DB.prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL
      )`,
    ).run();

    // Get current rate limit entry
    const entry = await env.MEMORY_DB.prepare(
      "SELECT count, window_start FROM rate_limits WHERE key = ?",
    )
      .bind(rateLimitKey)
      .first<{ count: number; window_start: number }>();

    if (entry) {
      // Check if we're in the same window
      if (entry.window_start > windowStart) {
        // Same window - check if exceeded
        if (entry.count >= config.maxRequests) {
          const retryAfter = Math.ceil(
            (entry.window_start + config.windowMs - now) / 1000,
          );
          return new Response(
            JSON.stringify({
              error: "Too Many Requests",
              message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
              retryAfter,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfter),
                "X-RateLimit-Limit": String(config.maxRequests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(
                  Math.ceil((entry.window_start + config.windowMs) / 1000),
                ),
              },
            },
          );
        }

        // Increment counter
        await env.MEMORY_DB.prepare(
          "UPDATE rate_limits SET count = count + 1 WHERE key = ?",
        )
          .bind(rateLimitKey)
          .run();
      } else {
        // New window - reset counter
        await env.MEMORY_DB.prepare(
          "UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?",
        )
          .bind(now, rateLimitKey)
          .run();
      }
    } else {
      // First request - create entry
      await env.MEMORY_DB.prepare(
        "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)",
      )
        .bind(rateLimitKey, now)
        .run();
    }

    // Request allowed
    return null;
  } catch (error) {
    // On error, allow the request (fail open)
    console.error("Rate limit check failed:", error);
    return null;
  }
}

/**
 * Cleanup old rate limit entries (call from scheduled handler)
 */
export async function cleanupRateLimits(
  env: Env,
): Promise<{ deleted: number }> {
  const cutoff = Date.now() - 3600000; // 1 hour old entries

  try {
    const result = await env.MEMORY_DB.prepare(
      "DELETE FROM rate_limits WHERE window_start < ?",
    )
      .bind(cutoff)
      .run();

    return { deleted: result.meta?.changes || 0 };
  } catch {
    return { deleted: 0 };
  }
}
