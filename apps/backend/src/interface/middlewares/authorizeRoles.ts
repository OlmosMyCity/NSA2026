import { Request, Response, NextFunction, RequestHandler } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../../domain/errors/AppError.js";

/**
 * Restringe una ruta a ciertos roles. Debe ir DESPUÉS de `authenticate`.
 * Ej: router.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete)
 */
export function authorizeRoles(...allowed: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
