import type { Request, Response, NextFunction } from "express";

export type MetricsStore = {
  startedAt: number;
  requestsTotal: number;
  responses2xx: number;
  responses3xx: number;
  responses4xx: number;
  responses5xx: number;
  latencyCount: number;
  latencyMsTotal: number;
  perPath: Record<
    string,
    {
      count: number;
      errors5xx: number;
      latencyCount: number;
      latencyMsTotal: number;
    }
  >;
};

export function createMetricsStore(): MetricsStore {
  return {
    startedAt: Date.now(),
    requestsTotal: 0,
    responses2xx: 0,
    responses3xx: 0,
    responses4xx: 0,
    responses5xx: 0,
    latencyCount: 0,
    latencyMsTotal: 0,
    perPath: {},
  };
}

function incStatusBucket(store: MetricsStore, statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) store.responses2xx += 1;
  else if (statusCode >= 300 && statusCode < 400) store.responses3xx += 1;
  else if (statusCode >= 400 && statusCode < 500) store.responses4xx += 1;
  else if (statusCode >= 500) store.responses5xx += 1;
}

function safePath(req: Request): string {
  // Keep metrics low-cardinality: avoid querystring and user-provided IDs.
  // Example: /v1/kb/sources/:id -> /v1/kb/sources/:id
  const base = (req.baseUrl || "") + (req.path || "");
  return base.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ":id");
}

export function metricsMiddleware() {
  return function (req: Request, res: Response, next: NextFunction) {
    const store: MetricsStore | undefined = (req.app.locals.metrics as any) ?? undefined;
    if (!store) return next();

    const started = Date.now();
    store.requestsTotal += 1;

    res.on("finish", () => {
      const ms = Date.now() - started;
      store.latencyCount += 1;
      store.latencyMsTotal += ms;
      incStatusBucket(store, res.statusCode);

      const p = safePath(req);
      const entry = store.perPath[p] || {
        count: 0,
        errors5xx: 0,
        latencyCount: 0,
        latencyMsTotal: 0,
      };
      entry.count += 1;
      entry.latencyCount += 1;
      entry.latencyMsTotal += ms;
      if (res.statusCode >= 500) entry.errors5xx += 1;
      store.perPath[p] = entry;
    });

    return next();
  };
}

export function getMetricsSnapshot(store: MetricsStore) {
  const avgLatencyMs = store.latencyCount ? store.latencyMsTotal / store.latencyCount : 0;
  const uptimeSec = Math.floor((Date.now() - store.startedAt) / 1000);

  const perPath = Object.entries(store.perPath)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([path, v]) => ({
      path,
      count: v.count,
      errors5xx: v.errors5xx,
      avgLatencyMs: v.latencyCount ? v.latencyMsTotal / v.latencyCount : 0,
    }));

  return {
    startedAt: new Date(store.startedAt).toISOString(),
    uptimeSec,
    requestsTotal: store.requestsTotal,
    responses: {
      "2xx": store.responses2xx,
      "3xx": store.responses3xx,
      "4xx": store.responses4xx,
      "5xx": store.responses5xx,
    },
    avgLatencyMs,
    topPaths: perPath,
  };
}
