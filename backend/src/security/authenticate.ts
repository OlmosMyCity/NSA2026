/**
 * @module authenticate
 * Express JWT authentication middleware and `Request.user` module augmentation.
 */

import { Request, Response, NextFunction } from "express";
import { AuthTokenPayload } from "../entity/User.js";
import { UnauthorizedError } from "../exception/AppError.js";
import { tokenService } from "./TokenService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated user claims injected by `authenticate` after verifying the JWT. */
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <jwt>` header; forwards `UnauthorizedError` (401)
 * to `errorHandler` if missing or invalid.
 */
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
