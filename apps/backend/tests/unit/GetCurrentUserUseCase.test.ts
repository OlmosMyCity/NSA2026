import { describe, it, expect, vi } from "vitest";
import { GetCurrentUserUseCase } from "../../src/application/use-cases/auth/GetCurrentUserUseCase.js";
import { IUserRepository } from "../../src/domain/repository/IUserRepository.js";
import { PublicUserWithAstronaut } from "../../src/domain/models/User.js";
import { UnauthorizedError } from "../../src/domain/errors/AppError.js";

const now = new Date();
const commander: PublicUserWithAstronaut = {
  id: "u-1",
  email: "r.wiseman@nasa.gov",
  name: "Reid Wiseman",
  role: "USER",
  state: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  astronaut: { id: "astro-1" },
};

const setup = (user: PublicUserWithAstronaut | null) => {
  const userRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(user),
    create: vi.fn(),
  };
  return { userRepo, useCase: new GetCurrentUserUseCase(userRepo) };
};

describe("GetCurrentUserUseCase", () => {
  it("debe devolver el usuario actual con astronautId", async () => {
    const { useCase, userRepo } = setup(commander);

    await expect(useCase.execute("u-1")).resolves.toEqual({
      id: "u-1",
      email: "r.wiseman@nasa.gov",
      name: "Reid Wiseman",
      role: "USER",
      astronautId: "astro-1",
    });
    expect(userRepo.findById).toHaveBeenCalledWith("u-1");
  });

  it("debe responder 401 si el usuario del token ya no existe", async () => {
    const { useCase } = setup(null);
    await expect(useCase.execute("u-borrado")).rejects.toThrow(UnauthorizedError);
  });

  it("debe responder 401 si la cuenta fue desactivada", async () => {
    const { useCase } = setup({ ...commander, state: "INACTIVE" });
    await expect(useCase.execute("u-1")).rejects.toThrow(UnauthorizedError);
  });
});
