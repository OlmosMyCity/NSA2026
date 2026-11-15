/**
 * @module securityHeaders
 * Express middleware setting defensive HTTP security headers and disabling shared caching on API responses.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Applies standard defensive browser security headers (`nosniff`, `DENY`, `no-referrer`,
 * restrictive `Permissions-Policy`, `COOP`) and sets `Cache-Control: no-store` on `/api` routes.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}
