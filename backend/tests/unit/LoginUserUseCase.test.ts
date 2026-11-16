import { describe, it, expect, vi } from "vitest";
import { LoginUserUseCase } from "../../src/service/auth/LoginUserUseCase.js";
import { IUserRepository } from "../../src/repository/IUserRepository.js";
import { UserWithAstronaut } from "../../src/entity/User.js";
import { UnauthorizedError, ValidationError } from "../../src/exception/AppError.js";

const now = new Date();
const commander: UserWithAstronaut = {
  id: "u-1",
  email: "r.wiseman@nasa.gov",
  name: "Reid Wiseman",
  passwordHash: "hash-correcto",
  role: "USER",
  state: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  astronaut: { id: "astro-1" },
};

function setup(user: UserWithAstronaut | null) {
  const userRepo: IUserRepository = {
    findByEmail: vi.fn().mockResolvedValue(user),
    findById: vi.fn(),
    create: vi.fn(),
  };
  const hasher = {
    hash: vi.fn(),
    compare: vi.fn(async (plain: string, hash: string) => plain === "OrionCrew#4IV" && hash === "hash-correcto"),
  };
  const tokens = { sign: vi.fn().mockReturnValue("jwt-token") };
  return { userRepo, tokens, useCase: new LoginUserUseCase(userRepo, hasher, tokens) };
}

describe("LoginUserUseCase", () => {
  it("debe devolver user (con astronautId) + token con credenciales válidas", async () => {
    const { useCase, userRepo, tokens } = setup(commander);

    const result = await useCase.execute({ email: " R.Wiseman@nasa.gov ", password: "OrionCrew#4IV" });

    expect(userRepo.findByEmail).toHaveBeenCalledWith("r.wiseman@nasa.gov");
    expect(tokens.sign).toHaveBeenCalledWith({ id: "u-1", email: "r.wiseman@nasa.gov", role: "USER" });
    expect(result).toEqual({
      user: { id: "u-1", email: "r.wiseman@nasa.gov", name: "Reid Wiseman", role: "USER", astronautId: "astro-1" },
      token: "jwt-token",
    });
    expect(JSON.stringify(result)).not.toContain("hash-correcto");
  });

  it("debe omitir astronautId si el usuario no tiene astronauta vinculado", async () => {
    const { useCase } = setup({ ...commander, role: "ADMIN", astronaut: null });
    const result = await useCase.execute({ email: "r.wiseman@nasa.gov", password: "OrionCrew#4IV" });
    expect(result.user).not.toHaveProperty("astronautId");
  });

  it("debe responder 401 genérico si el email no existe", async () => {
    const { useCase } = setup(null);
    await expect(useCase.execute({ email: "x@nasa.gov", password: "OrionCrew#4IV" })).rejects.toThrow(
      new UnauthorizedError("Invalid email or password.")
    );
  });

  it("debe responder 401 genérico si la contraseña es incorrecta", async () => {
    const { useCase, tokens } = setup(commander);
    await expect(useCase.execute({ email: "r.wiseman@nasa.gov", password: "mala" })).rejects.toThrow(
      "Invalid email or password."
    );
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it("debe responder 401 si la cuenta está INACTIVE", async () => {
    const { useCase } = setup({ ...commander, state: "INACTIVE" });
    await expect(useCase.execute({ email: "r.wiseman@nasa.gov", password: "OrionCrew#4IV" })).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("debe lanzar ValidationError si faltan campos", async () => {
    const { useCase } = setup(commander);
    await expect(useCase.execute({ email: "", password: "" })).rejects.toThrow(ValidationError);
  });
});
