/**
 * @module TokenService
 * JWT signing and verification service for stateless bearer authentication.
 */

import jwt, { SignOptions } from "jsonwebtoken";
import { AuthTokenPayload } from "../entity/User.js";
import { UnauthorizedError } from "../exception/AppError.js";

// Fail fast with no fallback default: the server must never sign tokens if JWT_SECRET is unset.
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured in environment variables.");
  }
  return secret;
}

/**
 * JWT token issuer and verifier mapping expired or malformed tokens to `UnauthorizedError` (401).
 */
export const tokenService = {
  /** Signs a bearer JWT embedding the user's `email` and `role` claims with `sub` set to `payload.id`. */
  sign(payload: AuthTokenPayload): string {
    const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];
    return jwt.sign({ email: payload.email, role: payload.role }, getSecret(), {
      subject: payload.id,
      expiresIn,
    });
  },

  /** Throws `UnauthorizedError` (401) if the token is invalid, expired, or missing required claims. */
  verify(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
      if (!decoded.sub || !decoded.email || !decoded.role) {
        throw new UnauthorizedError("Invalid token.");
      }
      return { id: decoded.sub, email: decoded.email, role: decoded.role };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token has expired. Please sign in again.");
      }
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Invalid token.");
    }
  },
};
