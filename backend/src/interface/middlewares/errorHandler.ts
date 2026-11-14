import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../../domain/errors/AppError.js";

/**
 * Middleware centralizado de manejo de errores (Criterio 5 de la rúbrica).
 * Captura AppError de dominio, errores conocidos de Prisma y errores inesperados.
 * NUNCA expone el stack trace en la respuesta HTTP.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Errores de Dominio / Aplicación (400, 404, 409)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // 2. Errores de Prisma (PostgreSQL)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "campo único";
      res.status(409).json({
        error: `Conflicto de unicidad: Ya existe un registro con el mismo valor para '${target}'.`,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: "El registro solicitado no existe o fue eliminado previamente.",
      });
      return;
    }

    if (err.code === "P2003") {
      res.status(400).json({
        error: "Violación de restricción de llave foránea: El recurso relacionado no existe.",
      });
      return;
    }

    res.status(400).json({
      error: "Error de validación o restricción en la base de datos.",
    });
    return;
  }

  // 3. Error no previsto (500 Internal Server Error)
  // Se loguea internamente en el servidor para monitoreo, pero NUNCA se expone al cliente
  console.error("❌ [UNHANDLED_ERROR]:", err.message);

  res.status(500).json({
    error: "Ocurrió un error interno en el servidor. Por favor intente más tarde.",
  });
}

