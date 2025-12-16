import { IRequest, error, json } from "itty-router";
import { Env } from "../types";

export class MediaController {
  static async upload(request: IRequest, env: Env) {
    if (!env.MEDIA_BUCKET) return error(503, "R2 not configured");
    const key = request.params.key;

    // Check allow-list or size limits if needed
    const object = await env.MEDIA_BUCKET.put(key, request.body);
    return json({ success: true, key: object?.key });
  }

  static async download(request: IRequest, env: Env) {
    if (!env.MEDIA_BUCKET) return error(503, "R2 not configured");
    const key = request.params.key;

    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return error(404, "Not found");

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  }
}
