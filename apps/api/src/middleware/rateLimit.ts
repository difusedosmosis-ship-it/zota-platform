import type { NextFunction, Request, Response } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function keyFor(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${req.path}`;
}

export function rateLimitMiddleware(limit = 120, windowMs = 60_000) {
  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = keyFor(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("retry-after", String(retryAfter));
      return res.status(429).json({ ok: false, message: "Too many requests" });
    }

    bucket.count += 1;
    next();
  };
}
