import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";

export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : "Internal server error";
  const details = err instanceof HttpError ? err.details : undefined;
  const requestId = res.getHeader("x-request-id") || null;

  if (status >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        method: req.method,
        path: req.path,
        message,
        stack: err?.stack ?? null,
      }),
    );
  }
  res.status(status).json({ ok: false, message, details, requestId });
}
