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
    const minLevel = resolveMinLogLevel();
    if (!shouldLog(level, minLevel)) return;

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

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

function resolveMinLogLevel(): LogLevel {
  const fromGlobal = (
    globalThis as unknown as { __APERION_LOG_LEVEL__?: unknown }
  ).__APERION_LOG_LEVEL__;
  if (typeof fromGlobal === "string") {
    const v = fromGlobal.toLowerCase();
    if (
      v === "debug" ||
      v === "info" ||
      v === "warn" ||
      v === "error" ||
      v === "silent"
    )
      return v;
  }

  const fromProcess =
    typeof process !== "undefined"
      ? (process as unknown as { env?: Record<string, string | undefined> }).env
          ?.APERION_LOG_LEVEL
      : undefined;
  if (typeof fromProcess === "string") {
    const v = fromProcess.toLowerCase();
    if (
      v === "debug" ||
      v === "info" ||
      v === "warn" ||
      v === "error" ||
      v === "silent"
    )
      return v;
  }

  return "info";
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  const rank: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 1_000,
  };
  return rank[level] >= rank[minLevel];
}
