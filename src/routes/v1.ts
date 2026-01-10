import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { healthController } from "../controllers/health.controller";
import { versionController } from "../controllers/version.controller";
import { publicConfigController } from "../controllers/publicConfig.controller";
import { metricsController } from "../controllers/metrics.controller";
import {
  createKbSourceController,
  deleteKbSourceController,
  listKbSourcesController,
} from "../controllers/kb.controller";
import { requireProjectFromHeader, requireProjectFromPath } from "../middlewares/projectContext";
import { enforceProjectOrigin } from "../middlewares/projectOrigin";
import { rateLimit } from "../middlewares/rateLimit";
import type { AppEnv } from "../config/env";

export function createV1Router(env: AppEnv) {
  const v1Router = Router();

  v1Router.get("/health", healthController);
  v1Router.get("/version", versionController);

  // PR-07: basic operational metrics (no auth; for local checks)
  v1Router.get("/metrics", metricsController);

  // Project-scoped endpoints (PR-03: multi-tenant enforcement)
  const projectChain = [
    requireProjectFromHeader(),
    enforceProjectOrigin({ nodeEnv: env.NODE_ENV }),
    rateLimit({ windowSec: env.RATE_LIMIT_WINDOW_SEC, max: env.RATE_LIMIT_MAX }),
  ] as const;

  v1Router.post("/chat", ...projectChain, chatController);

  // PR-05: Text-only Knowledge Base (KB)
  v1Router.get("/kb/sources", ...projectChain, listKbSourcesController);
  v1Router.post("/kb/sources", ...projectChain, createKbSourceController);
  v1Router.delete("/kb/sources/:id", ...projectChain, deleteKbSourceController);

  v1Router.get(
    "/projects/:key/public-config",
    requireProjectFromPath("key"),
    enforceProjectOrigin({ nodeEnv: env.NODE_ENV }),
    publicConfigController
  );

  return v1Router;
}
