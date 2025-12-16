import { Env } from "../types";

export interface MetricEvent {
  name: string;
  labels?: Record<string, string>;
  value?: number;
}

export class Metrics {
  constructor(private env: Env) {}

  /**
   * Records a metric event to Cloudflare Analytics Engine.
   * If METRICS binding is not available (e.g. tests), it degrades gracefully.
   */
  record(event: MetricEvent) {
    if (!this.env.METRICS) {
      return;
    }

    const { name, labels, value } = event;
    const blobs = [name, ...(labels ? Object.values(labels) : [])];
    const doubles = [value ?? 1];

    this.env.METRICS.writeDataPoint({
      blobs,
      doubles,
      indexes: [name], // Index by event name for fast filtering
    });
  }

  /**
   * Helper to record latency of an operation
   */
  async trackLatency<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>,
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.record({
        name,
        labels,
        value: duration,
      });
    }
  }
}
