import { Request, Response, NextFunction } from "express";

/**
 * Aplica encabezados defensivos estándar y evita caché compartida en respuestas `/api`.
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
