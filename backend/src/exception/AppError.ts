/**
 * @module exception/AppError
 * Domain error hierarchy mapped to HTTP status codes by the Express error-handling middleware.
 */

/**
 * Base abstract domain error carrying an HTTP status code.
 * Restores the prototype chain via `Object.setPrototypeOf` so `instanceof` checks work across transpiled `Error` subclasses.
 */
export abstract class AppError extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 404 error raised when a requested domain entity does not exist or is soft-deleted. */
export class NotFoundError extends AppError {
  public readonly statusCode = 404;

  constructor(resourceName: string, id?: string) {
    super(id ? `${resourceName} with ID '${id}' was not found.` : `${resourceName} not found.`);
  }
}

/** HTTP 400 error raised when domain invariants or input validations fail. */
export class ValidationError extends AppError {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

/** HTTP 401 error raised when authentication is missing, invalid, or expired. */
export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;

  constructor(message = "Authentication required or invalid token.") {
    super(message);
  }
}

/** HTTP 403 error raised when an authenticated user lacks permissions for the requested resource or action. */
export class ForbiddenError extends AppError {
  public readonly statusCode = 403;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
  }
}

/** HTTP 409 error raised on uniqueness or state-conflict violations. */
export class ConflictError extends AppError {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

