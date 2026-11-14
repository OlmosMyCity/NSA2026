import express, { Express } from "express";
import cors from "cors";
import { authRouter } from "./interface/routers/authRouter.js";
import { missionRouter } from "./interface/routers/missionRouter.js";
import { astronautRouter } from "./interface/routers/astronautRouter.js";
import { readingRouter } from "./interface/routers/healthReadingRouter.js";
import { biodosimetryRouter } from "./interface/routers/biodosimetryRouter.js";
import { adminRouter } from "./interface/routers/adminRouter.js";
import { radiationRouter } from "./interface/routers/radiationRouter.js";
import { uploadRouter } from "./interface/routers/uploadRouter.js";
import { errorHandler } from "./interface/middlewares/errorHandler.js";

/**
 * Función factory para instanciar y configurar la app de Express.
 * Permite usar la misma configuración para el servidor en producción y para pruebas E2E.
 */
export function createApp(): Express {
  const app = express();

  // Middlewares base
  app.use(cors());
  app.use(express.json());

  // Autenticación (register / login)
  app.use("/api/auth", authRouter);

  // Rutas de dominio: Misiones, Astronautas, Lecturas de Salud, Consola de Administración y Radiación
  app.use("/api/missions", missionRouter);
  app.use("/api/astronauts", astronautRouter);
  app.use("/api/readings", readingRouter);
  app.use("/api/health-readings", biodosimetryRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/radiation", radiationRouter);
  app.use("/api/uploads", uploadRouter);

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
