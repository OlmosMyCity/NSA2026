/**
 * @module errorHandler
 * Centralized Express error-handling middleware translating syntax, Zod, domain,
 * Prisma, and unexpected errors into sanitized JSON HTTP responses.
 */

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "./AppError.js";

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
    res.status(400).json({ error: "Invalid JSON request body." });
    return;
  }

  // 0b. HTTP schema validation failure (Zod)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message || "The provided data is invalid.",
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
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "unique field";
      res.status(409).json({
        error: `Uniqueness conflict: A record with the same value for '${target}' already exists.`,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: "The requested record does not exist or was previously deleted.",
      });
      return;
    }

    if (err.code === "P2003") {
      res.status(400).json({
        error: "Foreign key constraint violation: The related resource does not exist.",
      });
      return;
    }

    res.status(400).json({
      error: "Database validation or constraint error.",
    });
    return;
  }

  // 3. Unexpected internal error (500 Internal Server Error)
  // Logged server-side for monitoring, but NEVER leaked to the HTTP client.
  console.error("❌ [UNHANDLED_ERROR]:", err.message);

  res.status(500).json({
    error: "An internal server error occurred. Please try again later.",
  });
}

