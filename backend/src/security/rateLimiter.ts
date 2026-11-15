/**
 * @module rateLimiter
 * Lightweight, bounded in-memory IP rate-limiting middleware for authentication and sensitive mutations.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

/** Configuration for a fixed-window rate limiter instance. */
interface RateLimitOptions {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum permitted requests per IP within `windowMs`. */
  max: number;
  /** Localized HTTP 429 error payload message returned once `max` is exceeded. */
  message: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** Upper bound on tracked client buckets before sweeping expired entries to prevent unbounded memory growth. */
const MAX_TRACKED_KEYS = 2000;

/**
 * Creates an in-memory fixed-window rate limiter keyed by client IP.
 * Sets `Retry-After` on HTTP 429 responses and automatically bypasses enforcement when `NODE_ENV === "test"`.
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
