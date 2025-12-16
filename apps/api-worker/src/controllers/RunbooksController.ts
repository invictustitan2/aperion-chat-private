import { hashRunbookTask } from "@aperion/shared";
import { IRequest, error, json } from "itty-router";

export class RunbooksController {
  static async hash(request: IRequest) {
    const text = await request.text();
    if (!text) return error(400, "Missing body");

    const taskId = hashRunbookTask(text);
    return json({ taskId });
  }
}
