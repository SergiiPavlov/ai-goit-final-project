import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createV1Router } from "./routes/v1";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestId } from "./middlewares/requestId";
import { parseAllowedOrigins, type AppEnv } from "./config/env";
import { isOriginAllowedByAnyProject } from "./services/projects.service";

export function createApp(opts: { env: AppEnv }) {
  const app = express();

  // expose env to request handlers (PR-04)
  app.locals.env = opts.env;

  app.disable("x-powered-by");

  // Core middleware
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  // Logging with requestId
  morgan.token("rid", (req: any) => req.requestId ?? "-");
  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms rid=:rid")
  );

  const fallbackAllowedOrigins = parseAllowedOrigins(opts.env.ALLOWED_ORIGINS);

  // PR-03: CORS is a browser concern (server-to-server is unaffected).
  // We respond to preflight requests even before the projectKey is known.
  // Strategy:
  // - If ALLOWED_ORIGINS is configured: allow only those origins.
  // - Otherwise (local dev): allow origins that exist in ANY Project.allowedOrigins.
  // - If origin header is absent: allow.
  app.use(
    cors((req, cb) => {
      const origin = req.header("origin");
      if (!origin) {
        return cb(null, { origin: true, credentials: true });
      }

      // Explicit fallback allowlist (recommended for prod).
      if (fallbackAllowedOrigins.length > 0) {
        const ok = fallbackAllowedOrigins.includes(origin);
        return cb(null, { origin: ok, credentials: true });
      }

      // Dev-friendly: allow only known project origins.
      isOriginAllowedByAnyProject(origin)
        .then((ok) => cb(null, { origin: ok || opts.env.NODE_ENV === "development", credentials: true }))
        .catch(() => cb(null, { origin: opts.env.NODE_ENV === "development", credentials: true }));
    })
  );

  // Routes
  app.use("/v1", createV1Router(opts.env));

  // 404 + error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
