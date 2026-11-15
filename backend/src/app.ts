/**
 * @module app
 * Express application factory configuring security headers, CORS, rate limiting,
 * domain API routers, health checks, JSON 404 fallback, and centralized error handling.
 */

import express, { Express, Request } from "express";
import cors, { CorsOptions } from "cors";
import { authRouter } from "./controller/routes/authRouter.js";
import { missionRouter } from "./controller/routes/missionRouter.js";
import { astronautRouter } from "./controller/routes/astronautRouter.js";
import { readingRouter } from "./controller/routes/healthReadingRouter.js";
import { adminRouter } from "./controller/routes/adminRouter.js";
import { operatorRouter } from "./controller/routes/operatorRouter.js";
import { radiationRouter } from "./controller/routes/radiationRouter.js";
import { uploadRouter } from "./controller/routes/uploadRouter.js";
import { incidentRouter } from "./controller/routes/incidentRouter.js";
import { errorHandler } from "./exception/errorHandler.js";
import { securityHeaders } from "./security/securityHeaders.js";
import { createRateLimiter } from "./security/rateLimiter.js";

/**
 * Collects permitted CORS origins from static defaults, `ALLOWED_ORIGINS`, and Vercel deployment URLs.
 */
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "https://orbvital-nsa2026.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
  ]);

  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
  for (const item of envOrigins) {
    const trimmed = item.trim().replace(/\/+$/, "");
    if (trimmed) origins.add(trimmed);
  }

  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (host) origins.add(`https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`);
  }

  return origins;
}

/**
 * Builds a dynamic CORS delegate allowing configured origins, same-host requests, and non-browser callers.
 */
function buildCorsDelegate(): (req: Request, cb: (err: Error | null, options?: CorsOptions) => void) => void {
  const allowedOrigins = buildAllowedOrigins();

  return (req, callback) => {
    const origin = req.headers.origin;
    const reqHost = req.headers.host;

    const isSameHost =
      Boolean(origin && reqHost) &&
      (origin === `https://${reqHost}` || origin === `http://${reqHost}`);

    const allowOrigin = !origin || allowedOrigins.has(origin) || isSameHost;
    callback(null, {
      origin: allowOrigin,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  };
}

/**
 * Factory function that instantiates and configures the Express application.
 * Shared across production HTTP listeners, Vercel Serverless handlers, and E2E integration tests.
 */
export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Demasiados intentos de autenticación. Intenta de nuevo en unos minutos.",
  });

  const sensitiveMutationLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: "Límite de solicitudes excedido para esta operación.",
  });

  // Base security, CORS, and bounded JSON body parsing middleware
  app.use(securityHeaders);
  app.use(cors(buildCorsDelegate()));
  app.use(express.json({ limit: "256kb" }));

  // Authentication endpoints (register / login) protected by strict rate limiting
  app.use("/api/auth/login", authRateLimiter);
  app.use("/api/auth/register", authRateLimiter);
  app.use("/api/auth", authRouter);

  // Domain routes: Missions, Astronauts, Health Readings, Admin Triage Console, Radiation, Incidents, Uploads
  app.use("/api/missions", missionRouter);
  app.use("/api/astronauts", astronautRouter);
  app.use("/api/readings", readingRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/operator", operatorRouter);
  app.use("/api/radiation/simulate", sensitiveMutationLimiter);
  app.use("/api/radiation", radiationRouter);
  app.use("/api/incidents", incidentRouter);
  app.use("/api/uploads", sensitiveMutationLimiter, uploadRouter);

  // Lightweight microservice health check
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // JSON catch-all 404 handler to avoid Express's default HTML error responses
  app.use((req, res) => {
    res.status(404).json({
      error: `El recurso o ruta solicitada no existe (${req.method} ${req.originalUrl}).`,
    });
  });

  // Centralized error handler (must remain mounted after all routes)
  app.use(errorHandler);

  return app;
}

export default createApp();
