import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./errorHandler";
import { getProjectByKey, type ProjectRecord } from "../services/projects.service";

declare global {
  namespace Express {
    interface Request {
      project?: ProjectRecord;
      projectKey?: string;
    }
  }
}

const PROJECT_KEY_HEADER = "x-project-key";

export function requireProjectFromHeader() {
  return async function (req: Request, _res: Response, next: NextFunction) {
    const key = req.header(PROJECT_KEY_HEADER) ?? "";
    const projectKey = key.trim();
    if (!projectKey) {
      return next(new HttpError(401, "PROJECT_KEY_REQUIRED", "Missing X-Project-Key header"));
    }
    const project = await getProjectByKey(projectKey);
    if (!project) {
      return next(new HttpError(401, "PROJECT_KEY_INVALID", "Invalid X-Project-Key"));
    }
    req.project = project;
    req.projectKey = projectKey;
    return next();
  };
}

export function requireProjectFromPath(paramName: string = "key") {
  return async function (req: Request, _res: Response, next: NextFunction) {
    const projectKey = String((req.params as any)[paramName] ?? "").trim();
    if (!projectKey) {
      return next(new HttpError(400, "PROJECT_KEY_REQUIRED", `Missing :${paramName} path parameter`));
    }
    const project = await getProjectByKey(projectKey);
    if (!project) {
      return next(new HttpError(404, "PROJECT_NOT_FOUND", `Project not found for key: ${projectKey}`));
    }
    req.project = project;
    req.projectKey = projectKey;
    return next();
  };
}
