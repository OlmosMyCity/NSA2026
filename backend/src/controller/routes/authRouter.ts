/**
 * @module authRouter
 * Express router wiring user registration, login, and authenticated profile endpoints.
 */

import { Router } from "express";
import { AuthController } from "../AuthController.js";
import { PrismaUserRepository } from "../../repository/PrismaUserRepository.js";
import { passwordHasher } from "../../security/PasswordHasher.js";
import { tokenService } from "../../security/TokenService.js";
import { RegisterUserUseCase } from "../../service/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../../service/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../service/auth/GetCurrentUserUseCase.js";
import { authenticate } from "../../security/authenticate.js";

const userRepo = new PrismaUserRepository();

const controller = new AuthController(
  new RegisterUserUseCase(userRepo, passwordHasher, tokenService),
  new LoginUserUseCase(userRepo, passwordHasher, tokenService),
  new GetCurrentUserUseCase(userRepo)
);

/** Router mounted at `/api/auth` (`/register`, `/login`, and authenticated `/me`). */
export const authRouter = Router();

authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.get("/me", authenticate, controller.me);
