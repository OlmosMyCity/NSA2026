import jwt, { SignOptions } from "jsonwebtoken";
import { AuthTokenPayload } from "../../domain/models/User.js";
import { UnauthorizedError } from "../../domain/errors/AppError.js";

// Sin valor por defecto: si falta JWT_SECRET el servidor no debe firmar tokens.
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado en las variables de entorno.");
  }
  return secret;
}

export const tokenService = {
  sign(payload: AuthTokenPayload): string {
    const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];
    return jwt.sign({ email: payload.email, role: payload.role }, getSecret(), {
      subject: payload.id,
      expiresIn,
    });
  },

  /** Lanza UnauthorizedError (401) si el token es inválido, está expirado o mal formado. */
  verify(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
      if (!decoded.sub || !decoded.email || !decoded.role) {
        throw new UnauthorizedError("Token inválido.");
      }
      return { id: decoded.sub, email: decoded.email, role: decoded.role };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("El token ha expirado. Inicia sesión nuevamente.");
      }
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Token inválido.");
    }
  },
};
