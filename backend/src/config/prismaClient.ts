/**
 * @module prismaClient
 * Shared Prisma ORM client singleton. Caching the instance on `global.prisma` outside
 * production prevents exhausting database connections during module hot-reloading.
 */

import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

