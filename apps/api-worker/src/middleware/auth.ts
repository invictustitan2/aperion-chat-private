import { IRequest, error } from "itty-router";
import { Env } from "../types";

export const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    console.warn("Authentication failed: Missing Authorization header", {
      url: request.url,
      method: request.method,
    });
    return error(401, "Unauthorized: Missing Authorization header");
  }

  if (!env.API_TOKEN) {
    console.error("Authentication failed: API_TOKEN not configured in Worker");
    return error(401, "Unauthorized: Server authentication not configured");
  }

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

  const token = authHeader.replace("Bearer ", "");
  if (!token || token.trim() === "") {
    console.warn("Authentication failed: Empty token", {
      url: request.url,
    });
    return error(401, "Unauthorized: Empty authentication token");
  }

  if (token !== env.API_TOKEN) {
    console.warn("Authentication failed: Invalid token", {
      url: request.url,
      tokenPrefix: token.substring(0, 8) + "...",
    });
    return error(403, "Forbidden: Invalid credentials");
  }
};
