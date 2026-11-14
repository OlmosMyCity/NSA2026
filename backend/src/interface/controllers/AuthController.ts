import { Request, Response, NextFunction } from "express";
import { RegisterUserUseCase } from "../../application/use-cases/auth/RegisterUserUseCase.js";
import { LoginUserUseCase } from "../../application/use-cases/auth/LoginUserUseCase.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/auth/GetCurrentUserUseCase.js";
import { UnauthorizedError } from "../../domain/errors/AppError.js";

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = req.body ?? {};
      const result = await this.registerUserUseCase.execute({ name, email, password });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};
      const result = await this.loginUserUseCase.execute({ email, password });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** Requiere `authenticate` antes en la ruta. */
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
