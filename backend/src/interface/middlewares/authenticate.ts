import { Request, Response, NextFunction } from "express";
import { AuthTokenPayload } from "../../domain/models/User.js";
import { UnauthorizedError } from "../../domain/errors/AppError.js";
import { tokenService } from "../../infrastructure/services/TokenService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Inyectado por `authenticate` a partir del JWT. */
      user?: AuthTokenPayload;
    }
  }
}

/** Exige `Authorization: Bearer <jwt>` válido; si no, responde 401 vía errorHandler. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    next(new UnauthorizedError("Token de acceso requerido (Authorization: Bearer <token>)."));
    return;
  }

  try {
    req.user = tokenService.verify(token);
    next();
  } catch (error) {
    next(error);
  }
}
