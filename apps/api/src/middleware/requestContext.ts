import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id") || randomUUID();
  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
}
