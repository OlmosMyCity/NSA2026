/**
 * @module errorHandler
 * Centralized Express error-handling middleware translating syntax, Zod, domain,
 * Prisma, and unexpected errors into sanitized JSON HTTP responses.
 */

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors/AppError.js";

/**
 * Centralized error-handling middleware.
 * Catches domain `AppError` instances, known Prisma client errors, Zod validation failures,
 * and unexpected runtime exceptions. NEVER exposes stack traces in HTTP responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 0. Malformed JSON in HTTP request body
  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: "Cuerpo JSON inválido en la solicitud." });
    return;
  }

  // 0b. HTTP schema validation failure (Zod)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message || "Los datos proporcionados no son válidos.",
    });
    return;
  }

  // 1. Domain / Application errors (400, 401, 403, 404, 409)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // 2. Prisma ORM constraint / record errors (PostgreSQL)
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

  // 3. Unexpected internal error (500 Internal Server Error)
  // Logged server-side for monitoring, but NEVER leaked to the HTTP client.
  console.error("❌ [UNHANDLED_ERROR]:", err.message);

  res.status(500).json({
    error: "Ocurrió un error interno en el servidor. Por favor intente más tarde.",
  });
}

