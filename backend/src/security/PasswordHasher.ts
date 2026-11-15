/**
 * @module PasswordHasher
 * Bcrypt-based password hashing and verification utility for user authentication.
 */

import bcrypt from "bcrypt";

const SALT_ROUNDS = 10; // Matches the cost factor used in prisma/seed.ts

/**
 * Infrastructure adapter for password hashing and constant-time digest comparison.
 */
export const passwordHasher = {
  hash: (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS),
  compare: (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash),
};
