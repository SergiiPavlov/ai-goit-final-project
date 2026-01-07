import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { v1Router } from "./routes/v1";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestId } from "./middlewares/requestId";
import { parseAllowedOrigins } from "./config/env";

export function createApp(opts: { allowedOriginsRaw?: string }) {
  const app = express();

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

  const allowedOrigins = parseAllowedOrigins(opts.allowedOriginsRaw);

  // PR-02: If ALLOWED_ORIGINS is empty -> permissive for local dev.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // curl/server-to-server
        if (allowedOrigins.length === 0) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("CORS: Origin is not allowed"));
      },
      credentials: true,
    })
  );

  // Routes
  app.use("/v1", v1Router);

  // 404 + error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
