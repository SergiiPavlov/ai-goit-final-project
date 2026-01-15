import "express";

declare global {
  namespace Express {
    interface Request {
      /** Raw request body captured by express.json verify(). Useful for encoding recovery on Windows shells. */
      rawBody?: Buffer;
    }
  }
}

export {};
