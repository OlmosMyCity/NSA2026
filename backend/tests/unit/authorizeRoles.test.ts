import { describe, it, expect, vi } from "vitest";
import { Request, Response } from "express";
import { authorizeRoles } from "../../src/interface/middlewares/authorizeRoles.js";
import { ForbiddenError, UnauthorizedError } from "../../src/domain/errors/AppError.js";

const res = {} as Response;
const reqAs = (role?: "ADMIN" | "USER") =>
  ({ user: role ? { id: "u-1", email: "x@nasa.gov", role } : undefined }) as Request;

describe("authorizeRoles middleware (403)", () => {
  it("debe continuar si el rol está permitido", () => {
    const next = vi.fn();
    authorizeRoles("ADMIN")(reqAs("ADMIN"), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("debe aceptar cualquiera de varios roles permitidos", () => {
    const next = vi.fn();
    authorizeRoles("ADMIN", "USER")(reqAs("USER"), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("debe pasar ForbiddenError (403) si el rol no está permitido", () => {
    const next = vi.fn();
    authorizeRoles("ADMIN")(reqAs("USER"), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("debe pasar UnauthorizedError (401) si no hay usuario autenticado", () => {
    const next = vi.fn();
    authorizeRoles("ADMIN")(reqAs(), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
