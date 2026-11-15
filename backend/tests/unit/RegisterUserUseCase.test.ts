import { describe, it, expect, vi } from "vitest";
import { User } from "@prisma/client";
import { RegisterUserUseCase } from "../../src/service/auth/RegisterUserUseCase.js";
import { IUserRepository } from "../../src/repository/IUserRepository.js";
import { ConflictError, ValidationError } from "../../src/exception/AppError.js";

const now = new Date();
const storedUser: User = {
  id: "u-1",
  email: "j.hansen@nasa.gov",
  name: "Jeremy Hansen",
  passwordHash: "hashed",
  role: "USER",
  state: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

function setup(existing: User | null = null) {
  const userRepo: IUserRepository = {
    findByEmail: vi.fn().mockResolvedValue(existing),
    findById: vi.fn(),
    create: vi.fn().mockImplementation(async ({ passwordHash: _hash, ...rest }) => ({ ...storedUser, ...rest })),
  };
  const hasher = { hash: vi.fn().mockResolvedValue("hashed"), compare: vi.fn() };
  const tokens = { sign: vi.fn().mockReturnValue("jwt-token") };
  return { userRepo, hasher, tokens, useCase: new RegisterUserUseCase(userRepo, hasher, tokens) };
}

describe("RegisterUserUseCase", () => {
  it("debe crear un USER con contraseña hasheada y devolver user + token", async () => {
    const { useCase, userRepo, hasher } = setup();

    const result = await useCase.execute({ name: " Jeremy Hansen ", email: " J.Hansen@NASA.gov ", password: "secreto1" });

    expect(hasher.hash).toHaveBeenCalledWith("secreto1");
    expect(userRepo.create).toHaveBeenCalledWith({
      name: "Jeremy Hansen",
      email: "j.hansen@nasa.gov",
      passwordHash: "hashed",
    });
    expect(result).toEqual({
      user: { id: "u-1", email: "j.hansen@nasa.gov", name: "Jeremy Hansen", role: "USER" },
      token: "jwt-token",
    });
    expect(JSON.stringify(result)).not.toContain("hashed");
  });

  it("debe responder 409 si el email ya está registrado", async () => {
    const { useCase, userRepo } = setup(storedUser);

    await expect(
      useCase.execute({ name: "Otro", email: "j.hansen@nasa.gov", password: "secreto1" })
    ).rejects.toThrow(ConflictError);
    expect(userRepo.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "", email: "a@b.co", password: "secreto1" }, "nombre"],
    [{ name: "Ana", email: "no-es-email", password: "secreto1" }, "email"],
    [{ name: "Ana", email: "a@b.co", password: "123" }, "contraseña"],
  ])("debe lanzar ValidationError con datos inválidos (%#)", async (input, field) => {
    const { useCase } = setup();
    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    await expect(useCase.execute(input)).rejects.toThrow(field);
  });
});
