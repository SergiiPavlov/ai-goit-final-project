import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { healthController } from "../controllers/health.controller";
import { versionController } from "../controllers/version.controller";
import { publicConfigController } from "../controllers/publicConfig.controller";

export const v1Router = Router();

v1Router.get("/health", healthController);
v1Router.get("/version", versionController);

// Placeholders (PR-02)
v1Router.post("/chat", chatController);
v1Router.get("/projects/:key/public-config", publicConfigController);
