export abstract class AppError extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;

  constructor(resourceName: string, id?: string) {
    super(id ? `${resourceName} con ID '${id}' no fue encontrado.` : `${resourceName} no encontrado.`);
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;

  constructor(message = "Autenticación requerida o token inválido.") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;

  constructor(message = "No tienes permisos para realizar esta acción.") {
    super(message);
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

