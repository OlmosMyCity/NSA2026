import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { errorHandler } from "../../src/exception/errorHandler.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from "../../src/exception/AppError.js";

describe("errorHandler - Middleware Centralizado", () => {
  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  };

  const req = {} as Request;
  const next = vi.fn() as NextFunction;

  it("debe responder 404 para NotFoundError", () => {
    const res = createMockResponse();
    const error = new NotFoundError("Misión", "m-123");

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("m-123") })
    );
  });

  it("debe responder 400 para ValidationError", () => {
    const res = createMockResponse();
    const error = new ValidationError("El campo 'name' es requerido.");

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "El campo 'name' es requerido." });
  });

  it("debe responder 409 para ConflictError", () => {
    const res = createMockResponse();
    const error = new ConflictError("El correo ya está registrado.");

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "El correo ya está registrado." });
  });

  it("debe responder 401 para UnauthorizedError con mensaje por defecto", () => {
    const res = createMockResponse();

    errorHandler(new UnauthorizedError(), req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required or invalid token." });
  });

  it("debe responder 403 para ForbiddenError", () => {
    const res = createMockResponse();

    errorHandler(new ForbiddenError("Solo el cirujano de vuelo puede borrar misiones."), req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Solo el cirujano de vuelo puede borrar misiones." });
  });

  it("debe capturar error P2002 de Prisma y responder 409", () => {
    const res = createMockResponse();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "6.0.0",
      meta: { target: ["email"] },
    });

    errorHandler(prismaError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("email") })
    );
  });

  it("debe capturar error P2025 de Prisma y responder 404", () => {
    const res = createMockResponse();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "6.0.0",
    });

    errorHandler(prismaError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("debe responder 500 genérico sin filtrar stack trace para errores desconocidos", () => {
    const res = createMockResponse();
    const unknownError = new Error("Database disk full or crashed");

    // Silenciar console.error durante el test
    vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(unknownError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "An internal server error occurred. Please try again later.",
    });
  });
});

