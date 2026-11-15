/**
 * @module authorizeRoles
 * Role-based access control (RBAC) Express middleware factory.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../../domain/errors/AppError.js";

/**
 * Restricts a route to users holding one of the specified roles. Must run AFTER `authenticate`.
 * Forwards `UnauthorizedError` (401) if unauthenticated or `ForbiddenError` (403) if disallowed.
 * Example: `router.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete)`
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
