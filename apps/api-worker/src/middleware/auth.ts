import { IRequest, error } from "itty-router";
import { Env } from "../types";

export const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get("Authorization");

  // For WebSocket: browsers can't set headers, so check query param
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");

  // Get token from either header or query param
  let token: string | null = null;

  if (authHeader) {
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("Authentication failed: Invalid Authorization scheme", {
        url: request.url,
        scheme: authHeader.split(" ")[0],
      });
      return error(
        401,
        "Unauthorized: Invalid authentication scheme. Use 'Bearer <token>'",
      );
    }
    token = authHeader.replace("Bearer ", "");
  } else if (queryToken) {
    // Accept token from query param (for WebSocket)
    token = queryToken;
  }

  if (!token || token.trim() === "") {
    console.warn("Authentication failed: Missing token", {
      url: request.url,
      method: request.method,
    });
    return error(401, "Unauthorized: Missing authentication token");
  }

  if (!env.API_TOKEN) {
    console.error("Authentication failed: API_TOKEN not configured in Worker");
    return error(401, "Unauthorized: Server authentication not configured");
  }

  if (token !== env.API_TOKEN) {
    console.warn("Authentication failed: Invalid token", {
      url: request.url,
      tokenPrefix: token.substring(0, 8) + "...",
    });
    return error(403, "Forbidden: Invalid credentials");
  }
};
