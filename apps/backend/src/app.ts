import express, { Express, Request } from "express";
import cors, { CorsOptions } from "cors";
import { authRouter } from "./interface/routers/authRouter.js";
import { missionRouter } from "./interface/routers/missionRouter.js";
import { astronautRouter } from "./interface/routers/astronautRouter.js";
import { readingRouter } from "./interface/routers/healthReadingRouter.js";
import { adminRouter } from "./interface/routers/adminRouter.js";
import { operatorRouter } from "./interface/routers/operatorRouter.js";
import { radiationRouter } from "./interface/routers/radiationRouter.js";
import { uploadRouter } from "./interface/routers/uploadRouter.js";
import { incidentRouter } from "./interface/routers/incidentRouter.js";
import { errorHandler } from "./interface/middlewares/errorHandler.js";
import { securityHeaders } from "./interface/middlewares/securityHeaders.js";
import { createRateLimiter } from "./interface/middlewares/rateLimiter.js";

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
 * Función factory para instanciar y configurar la app de Express.
 * Permite usar la misma configuración para el servidor en producción y para pruebas E2E.
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

  // Middlewares base
  app.use(securityHeaders);
  app.use(cors(buildCorsDelegate()));
  app.use(express.json({ limit: "256kb" }));

  // Autenticación (register / login) con limitación de tasa
  app.use("/api/auth/login", authRateLimiter);
  app.use("/api/auth/register", authRateLimiter);
  app.use("/api/auth", authRouter);

  // Rutas de dominio: Misiones, Astronautas, Lecturas de Salud, Consola de Administración y Radiación
  app.use("/api/missions", missionRouter);
  app.use("/api/astronauts", astronautRouter);
  app.use("/api/readings", readingRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/operator", operatorRouter);
  app.use("/api/radiation/simulate", sensitiveMutationLimiter);
  app.use("/api/radiation", radiationRouter);
  app.use("/api/incidents", incidentRouter);
  app.use("/api/uploads", sensitiveMutationLimiter, uploadRouter);

  // Health check rápido del microservicio
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Ruta catch-all 404 en JSON para evitar respuestas HTML por defecto de Express
  app.use((req, res) => {
    res.status(404).json({
      error: `El recurso o ruta solicitada no existe (${req.method} ${req.originalUrl}).`,
    });
  });

  // Middleware centralizado de errores (siempre al final de las rutas)
  app.use(errorHandler);

  return app;
}

export default createApp();
