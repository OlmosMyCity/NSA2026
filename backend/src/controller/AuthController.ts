/**
 * @module AuthController
 * HTTP controller for user registration, credential login, and authenticated profile retrieval.
 */

import { Request, Response, NextFunction } from "express";
import { RegisterUserUseCase } from "../service/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../service/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../service/auth/GetCurrentUserUseCase.js";
import { UnauthorizedError } from "../exception/AppError.js";

/**
 * Controller exposing `/api/auth` endpoints.
 */
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  /** `POST /api/auth/register` — Registers a new user and returns a signed JWT. */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = req.body ?? {};
      const result = await this.registerUserUseCase.execute({ name, email, password });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** `POST /api/auth/login` — Authenticates credentials and returns a signed JWT. */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};
      const result = await this.loginUserUseCase.execute({ email, password });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** `GET /api/auth/me` — Returns the current user profile. Requires `authenticate` middleware upstream. */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const user = await this.getCurrentUserUseCase.execute(req.user.id);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };
}
