import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { PrismaUserRepository } from "../../infrastructure/repository/PrismaUserRepository.js";
import { passwordHasher } from "../../infrastructure/services/PasswordHasher.js";
import { tokenService } from "../../infrastructure/services/TokenService.js";
import { RegisterUserUseCase } from "../../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/auth/GetCurrentUserUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";

const userRepo = new PrismaUserRepository();

const controller = new AuthController(
  new RegisterUserUseCase(userRepo, passwordHasher, tokenService),
  new LoginUserUseCase(userRepo, passwordHasher, tokenService),
  new GetCurrentUserUseCase(userRepo)
);

export const authRouter = Router();

authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.get("/me", authenticate, controller.me);
