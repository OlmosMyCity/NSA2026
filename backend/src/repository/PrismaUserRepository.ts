/**
 * @module PrismaUserRepository
 * PostgreSQL/Prisma implementation of `IUserRepository`. Enforces `passwordHash` omission on
 * public queries and auto-provisions an `Astronaut` profile on the earliest active mission for
 * standard `USER` accounts.
 */

import { IUserRepository } from "./IUserRepository.js";
import { CreateUserDTO, PublicUserWithAstronaut, UserWithAstronaut } from "../entity/User.js";
import { prisma } from "../config/prismaClient.js";

// Prisma `omit` ensures password hashes never leak from this layer in public queries.
const withoutPassword = { passwordHash: true } as const;

/**
 * Prisma-backed repository for user credentials and linked crew-member records.
 */
export class PrismaUserRepository implements IUserRepository {
  /**
   * Looks up an active user by normalized email (including `passwordHash` for login verification).
   * Lazily provisions an `Astronaut` record on the earliest active mission if a standard `USER` lacks one.
   */
  async findByEmail(email: string): Promise<UserWithAstronaut | null> {
    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
      include: { astronaut: { select: { id: true } } },
    });

    if (user && user.role === "USER" && !user.astronaut) {
      const activeMission = await prisma.mission.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (activeMission) {
        const astronaut = await prisma.astronaut.create({
          data: {
            missionId: activeMission.id,
            userId: user.id,
            name: user.name,
            role: "Mission Specialist",
            age: 35,
          },
          select: { id: true },
        });
        return { ...user, astronaut };
      }
    }

    return user;
  }

  /** Fetches a public user profile (`passwordHash` omitted) with its linked astronaut ID. */
  async findById(id: string): Promise<PublicUserWithAstronaut | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      omit: withoutPassword,
      include: { astronaut: { select: { id: true } } },
    });
  }

  /**
   * Creates a new user inside a transaction and, for standard `USER` accounts,
   * automatically links a newly created `Astronaut` profile to the earliest active mission.
   */
  async create(data: CreateUserDTO): Promise<PublicUserWithAstronaut> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.trim().toLowerCase(),
          name: data.name.trim(),
          passwordHash: data.passwordHash,
          role: data.role,
        },
        omit: withoutPassword,
      });

      // Standard user (astronaut): automatically link to the active mission
      if (!data.role || data.role === "USER") {
        const activeMission = await tx.mission.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

        if (activeMission) {
          const astronaut = await tx.astronaut.create({
            data: {
              missionId: activeMission.id,
              userId: user.id,
              name: user.name,
              role: "Mission Specialist",
              age: 35,
            },
            select: { id: true },
          });

          return { ...user, astronaut };
        }
      }

      return { ...user, astronaut: null };
    });
  }
}
