import { describe, it, expect, vi, beforeAll } from "vitest";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../../src/interface/middlewares/authenticate.js";
import { tokenService } from "../../src/infrastructure/services/TokenService.js";
import { UnauthorizedError } from "../../src/domain/errors/AppError.js";

const res = {} as Response;
const reqWith = (authorization?: string) => ({ headers: { authorization } }) as Request;

describe("authenticate middleware (401)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "secreto-de-prueba";
  });

  it("debe inyectar req.user y continuar con un Bearer válido", () => {
    const token = tokenService.sign({ id: "u-1", email: "r.wiseman@nasa.gov", role: "USER" });
    const req = reqWith(`Bearer ${token}`);
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: "u-1", email: "r.wiseman@nasa.gov", role: "USER" });
  });

  it.each([
    ["sin header", undefined],
    ["esquema distinto a Bearer", "Basic abc"],
    ["Bearer vacío", "Bearer "],
    ["token basura", "Bearer no.es.jwt"],
    ["token firmado con otro secreto", `Bearer ${jwt.sign({ email: "x", role: "ADMIN" }, "otro", { subject: "u-9" })}`],
  ])("debe pasar UnauthorizedError a next: %s", (_caso, authorization) => {
    const req = reqWith(authorization);
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(req.user).toBeUndefined();
  });
});
