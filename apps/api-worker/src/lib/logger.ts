export class Logger {
  private traceId: string;
  private source: string;

  constructor(traceId: string, source: string = "api-worker") {
    this.traceId = traceId;
    this.source = source;
  }

  private log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    data?: Record<string, unknown>,
  ) {
    const payload = {
      level,
      message,
      traceId: this.traceId,
      source: this.source,
      timestamp: new Date().toISOString(),
      ...data,
    };

    // Cloudflare logs capture stdout/stderr
    console.log(JSON.stringify(payload));
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log("error", message, data);
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log("debug", message, data);
  }
}
