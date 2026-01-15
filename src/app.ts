import express from "express";
import path from "path";
import helmet from "helmet";
import morgan from "morgan";
import { createV1Router } from "./routes/v1";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestId } from "./middlewares/requestId";
import { createMetricsStore, metricsMiddleware } from "./middlewares/metrics";
import { parseAllowedOrigins, type AppEnv } from "./config/env";
import { isOriginAllowedByAnyProject } from "./services/projects.service";

export function createApp(opts: { env: AppEnv }) {
  const app = express();

  // expose env to request handlers (PR-04)
  app.locals.env = opts.env;

  // PR-07: in-memory metrics store (exported via GET /v1/metrics)
  app.locals.metrics = createMetricsStore();

  app.disable("x-powered-by");

  // Core middleware
  app.use(helmet());
  app.use(express.json({
    limit: "1mb",
    type: ["application/json", "application/*+json"],
    verify: (req, _res, buf) => {
      // Capture raw bytes for optional encoding recovery.
      (req as any).rawBody = buf;
    },
  }));
  app.use(requestId);
  app.use(metricsMiddleware());

  // Logging with requestId
  morgan.token("rid", (req: any) => req.requestId ?? "-");
  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms rid=:rid")
  );

  // Global (env-level) allowlist.
  // IMPORTANT: we treat it as an *additional* allowlist, not an override.
  // Otherwise a partially configured ALLOWED_ORIGINS would accidentally block origins
  // that are explicitly allowed per project (Project.allowedOrigins), breaking the widget.
  const envAllowedOrigins = parseAllowedOrigins(opts.env.ALLOWED_ORIGINS);

  // PR-03/06: Dynamic CORS for the public widget + API.
  //
  // We intentionally keep CORS decisions aligned with the same allowlist used by the API:
  // - If ALLOWED_ORIGINS is configured: allow only those origins.
  // - Otherwise: allow only origins present in ANY Project.allowedOrigins (seeded locally, configurable per project).
  //
  // IMPORTANT:
  // - Browsers require a successful preflight (OPTIONS) for cross-origin fetch() with custom headers (X-Project-Key).
  // - Relying on Express default OPTIONS often returns "Allow: GET,HEAD" without CORS headers, which breaks the widget.
  //
  // This middleware:
  // - Sets Access-Control-* headers for allowed origins
  // - Answers OPTIONS preflight with 204
  // - Rejects disallowed origins with ORIGIN_NOT_ALLOWED early (consistent with project allowlist)
  app.use(async (req: any, res, next) => {
    const origin = req.header("origin");
    if (!origin) return next();

    // Always allow same-origin requests (e.g., /demo -> /v1/chat).
    // Note: behind a proxy (Render), protocol may be forwarded.
    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
      ?.split(",")[0]
      ?.trim();
    const proto = forwardedProto || req.protocol;
    const selfOrigin = `${proto}://${req.get("host")}`;

    let allowed = origin === selfOrigin || envAllowedOrigins.includes(origin);

    if (!allowed) {
      try {
        allowed = await isOriginAllowedByAnyProject(origin);
      } catch {
        allowed = false;
      }
    }

    if (!allowed) {
      return res.status(403).json({
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "Origin is not allowed",
          requestId: req.requestId ?? undefined,
        },
      });
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      const reqHeaders =
        req.header("access-control-request-headers") ||
        "Content-Type, Authorization, X-Project-Key";
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", reqHeaders);
      res.setHeader("Access-Control-Max-Age", "600");
      return res.sendStatus(204);
    }

    return next();
  });

  // PR-06: The widget is designed to be embedded on third-party sites.
  // Helmet sets Cross-Origin-Resource-Policy: same-origin by default, which blocks <script src=".../widget.js">
  // from other origins. We relax CORP ONLY for /widget/* static assets.
  app.use("/widget", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });

  // PR-06: minimal integration widget (served as static assets)
  // Note: build step does NOT copy assets; we serve from repo root (public/*)
  // so deploy must include the /public folder next to /dist.
  app.use(
    "/widget",
    express.static(path.join(process.cwd(), "public"), {
      fallthrough: true,
      // keep caching conservative for easy iteration
      maxAge: opts.env.NODE_ENV === "production" ? "1h" : 0,
      setHeaders(res) {
        // Ensure the browser treats the file correctly
        if (res.req?.path?.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        }
        if (res.req?.path?.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        }
      },
    })
  );

  // PR-01: demo UI (for reviewers / local checks)
  app.use(
    "/demo",
    express.static(path.join(process.cwd(), "public", "demo"), {
      fallthrough: true,
      maxAge: opts.env.NODE_ENV === "production" ? "10m" : 0,
      setHeaders(res) {
        if (res.req?.path?.endsWith(".html") || res.req?.path === "/") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
        }
        if (res.req?.path?.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        }
        if (res.req?.path?.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        }
      },
    })
  );

  // API routes
  app.use("/v1", createV1Router(opts.env));

  // 404 + error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
