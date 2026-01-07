import type { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  // Default
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  res.status(status).json({
    error: {
      code,
      message,
      requestId,
    },
  });
}
