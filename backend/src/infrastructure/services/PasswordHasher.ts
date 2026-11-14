import bcrypt from "bcrypt";

const SALT_ROUNDS = 10; // Igual que en prisma/seed.ts

export const passwordHasher = {
  hash: (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS),
  compare: (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash),
};
