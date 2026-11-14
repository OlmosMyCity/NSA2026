import { IUserRepository } from "../../domain/repository/IUserRepository.js";
import { CreateUserDTO, PublicUserWithAstronaut, UserWithAstronaut } from "../../domain/models/User.js";
import { prisma } from "../database/prismaClient.js";

// Prisma `omit` garantiza que el hash nunca salga de esta capa en las consultas públicas.
const withoutPassword = { passwordHash: true } as const;

export class PrismaUserRepository implements IUserRepository {
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
            role: "Especialista de Misión",
            age: 35,
          },
          select: { id: true },
        });
        return { ...user, astronaut };
      }
    }

    return user;
  }

  async findById(id: string): Promise<PublicUserWithAstronaut | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      omit: withoutPassword,
      include: { astronaut: { select: { id: true } } },
    });
  }

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

      // Si es un usuario estándar (astronauta), vincularlo automáticamente a la misión activa
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
              role: "Especialista de Misión",
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
