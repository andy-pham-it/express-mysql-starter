import { Request, Response, NextFunction } from "express";

// Wraps async route handlers so rejected promises reach the central error middleware.
// (Express 4 does not catch async errors on its own.)
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
