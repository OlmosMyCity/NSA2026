import { Request, Response, NextFunction, RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 2000;

/**
 * Limitador de tasa en memoria con ventana fija acotada por IP.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const store = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === "test") {
      next();
      return;
    }

    const now = Date.now();
    if (store.size > MAX_TRACKED_KEYS) {
      for (const [k, bucket] of store.entries()) {
        if (bucket.resetAt <= now) store.delete(k);
      }
    }

    const key = req.ip || req.socket.remoteAddress || "unknown";
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}
