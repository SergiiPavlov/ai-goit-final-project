import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { healthController } from "../controllers/health.controller";
import { versionController } from "../controllers/version.controller";
import { publicConfigController } from "../controllers/publicConfig.controller";
import { requireProjectFromHeader, requireProjectFromPath } from "../middlewares/projectContext";
import { enforceProjectOrigin } from "../middlewares/projectOrigin";
import { rateLimit } from "../middlewares/rateLimit";
import type { AppEnv } from "../config/env";

export function createV1Router(env: AppEnv) {
  const v1Router = Router();

  v1Router.get("/health", healthController);
  v1Router.get("/version", versionController);

  // Project-scoped endpoints (PR-03: multi-tenant enforcement)
  v1Router.post(
    "/chat",
    requireProjectFromHeader(),
    enforceProjectOrigin({ nodeEnv: env.NODE_ENV }),
    rateLimit({ windowSec: env.RATE_LIMIT_WINDOW_SEC, max: env.RATE_LIMIT_MAX }),
    chatController
  );

  v1Router.get(
    "/projects/:key/public-config",
    requireProjectFromPath("key"),
    enforceProjectOrigin({ nodeEnv: env.NODE_ENV }),
    publicConfigController
  );

  return v1Router;
}
