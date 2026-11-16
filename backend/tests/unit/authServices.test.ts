import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { passwordHasher } from "../../src/security/PasswordHasher.js";
import { tokenService } from "../../src/security/TokenService.js";
import { UnauthorizedError } from "../../src/exception/AppError.js";

describe("passwordHasher (bcrypt)", () => {
  it("debe generar un hash distinto a la contraseña y validarlo", async () => {
    const hash = await passwordHasher.hash("OrionCrew#4IV");

    expect(hash).not.toBe("OrionCrew#4IV");
    expect(await passwordHasher.compare("OrionCrew#4IV", hash)).toBe(true);
    expect(await passwordHasher.compare("otra", hash)).toBe(false);
  });
});

describe("tokenService (JWT)", () => {
  const payload = { id: "u-1", email: "r.wiseman@nasa.gov", role: "USER" as const };
  const original = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "secreto-de-prueba";
  });

  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  it("debe firmar y verificar un token devolviendo el mismo payload", () => {
    const token = tokenService.sign(payload);
    expect(tokenService.verify(token)).toEqual(payload);
  });

  it("debe lanzar error si JWT_SECRET no está configurado", () => {
    delete process.env.JWT_SECRET;
    expect(() => tokenService.sign(payload)).toThrow("JWT_SECRET");
  });

  it("debe lanzar UnauthorizedError con token firmado con otro secreto", () => {
    const forged = jwt.sign({ email: payload.email, role: payload.role }, "otro", { subject: "u-1" });
    expect(() => tokenService.verify(forged)).toThrow(UnauthorizedError);
  });

  it("debe lanzar UnauthorizedError con token expirado", () => {
    const expired = jwt.sign({ email: payload.email, role: payload.role }, "secreto-de-prueba", {
      subject: "u-1",
      expiresIn: -10,
    });
    expect(() => tokenService.verify(expired)).toThrow("expired");
  });
});
