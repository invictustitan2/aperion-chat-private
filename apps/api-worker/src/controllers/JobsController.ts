import { IRequest, error, json } from "itty-router";
import { Env } from "../types";

export class JobsController {
  static async get(request: IRequest, env: Env) {
    const jobId = request.params.id;
    const job = await env.MEMORY_DB.prepare("SELECT * FROM jobs WHERE id = ?")
      .bind(jobId)
      .first();

    if (!job) {
      return error(404, "Job not found");
    }

    let result = null;
    if (job.output) {
      try {
        result = JSON.parse(job.output as string);
      } catch {
        result = job.output;
      }
    }

    return json({
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      result,
      error: job.error,
    });
  }
}
