import { HealthReading, HealthStatus, Prisma } from "@prisma/client";
import {
  AstronautHealthSummary,
  IHealthReadingRepository,
} from "../../domain/repository/IHealthReadingRepository.js";
import {
  HealthReadingFilters,
  PaginatedResult,
} from "../../domain/models/HealthReading.js";
import { prisma } from "../database/prismaClient.js";

function normalizeAlertMessages(alerts: unknown): string[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "message" in item) {
      return String((item as { message: unknown }).message);
    }
    return JSON.stringify(item);
  });
}

export class PrismaHealthReadingRepository implements IHealthReadingRepository {
  async findMany(filters: HealthReadingFilters): Promise<PaginatedResult<HealthReading>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.HealthReadingWhereInput = {
      deletedAt: null,
    };

    if (filters.astronautId) {
      where.astronautId = filters.astronautId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.from || filters.to) {
      where.takenAt = {};
      if (filters.from) {
        where.takenAt.gte = filters.from;
      }
      if (filters.to) {
        where.takenAt.lte = filters.to;
      }
    }

    const [total, data] = await Promise.all([
      prisma.healthReading.count({ where }),
      prisma.healthReading.findMany({
        where,
        skip,
        take: limit,
        orderBy: { takenAt: "desc" },
        include: {
          astronaut: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      pagination: {
        total,
        currentPage: page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<HealthReading | null> {
    return prisma.healthReading.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        astronaut: true,
      },
    });
  }

  async create(data: {
    astronautId: string;
    heartRateBpm: number;
    systolicMmHg: number;
    diastolicMmHg: number;
    glucoseMgDl: number;
    temperatureC: number;
    spo2Pct: number;
    sleepHours: number;
    mood: number;
    status: HealthStatus;
    alerts: object;
    recommendation: string;
    notes?: string | null;
    takenAt?: Date;
  }): Promise<HealthReading> {
    return prisma.healthReading.create({
      data: {
        astronautId: data.astronautId,
        heartRateBpm: data.heartRateBpm,
        systolicMmHg: data.systolicMmHg,
        diastolicMmHg: data.diastolicMmHg,
        glucoseMgDl: data.glucoseMgDl,
        temperatureC: data.temperatureC,
        spo2Pct: data.spo2Pct,
        sleepHours: data.sleepHours,
        mood: data.mood,
        status: data.status,
        alerts: data.alerts as Prisma.InputJsonValue,
        recommendation: data.recommendation,
        notes: data.notes,
        takenAt: data.takenAt || new Date(),
      },
    });
  }

  async update(
    id: string,
    data: {
      heartRateBpm?: number;
      systolicMmHg?: number;
      diastolicMmHg?: number;
      glucoseMgDl?: number;
      temperatureC?: number;
      spo2Pct?: number;
      sleepHours?: number;
      mood?: number;
      status?: HealthStatus;
      alerts?: object;
      recommendation?: string | null;
      notes?: string | null;
      takenAt?: Date;
    }
  ): Promise<HealthReading | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    return prisma.healthReading.update({
      where: { id },
      data: {
        heartRateBpm: data.heartRateBpm,
        systolicMmHg: data.systolicMmHg,
        diastolicMmHg: data.diastolicMmHg,
        glucoseMgDl: data.glucoseMgDl,
        temperatureC: data.temperatureC,
        spo2Pct: data.spo2Pct,
        sleepHours: data.sleepHours,
        mood: data.mood,
        status: data.status,
        ...(data.alerts !== undefined ? { alerts: data.alerts as Prisma.InputJsonValue } : {}),
        recommendation: data.recommendation,
        notes: data.notes,
        takenAt: data.takenAt,
      },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await prisma.healthReading.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }

  async getAstronautHealthSummary(astronautId: string): Promise<AstronautHealthSummary | null> {
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      include: { mission: true },
    });

    if (!astronaut) return null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentHistory7d, totalReadingsCount] = await Promise.all([
      prisma.healthReading.findMany({
        where: {
          astronautId,
          deletedAt: null,
          takenAt: { gte: sevenDaysAgo },
        },
        orderBy: { takenAt: "desc" },
      }),
      prisma.healthReading.count({
        where: { astronautId, deletedAt: null },
      }),
    ]);

    const latest =
      recentHistory7d[0] ||
      (await prisma.healthReading.findFirst({
        where: { astronautId, deletedAt: null },
        orderBy: { takenAt: "desc" },
      }));

    const astronautInfo = {
      id: astronaut.id,
      name: astronaut.name,
      role: astronaut.role,
      mission: { id: astronaut.mission.id, name: astronaut.mission.name },
    };

    if (!latest) {
      return {
        astronautId: astronaut.id,
        astronautName: astronaut.name,
        missionName: astronaut.mission.name,
        currentStatus: HealthStatus.OK,
        latestReading: null,
        systems: {
          cardiovascular: { status: HealthStatus.OK, hr: 70, bp: "120/80" },
          metabolic: { status: HealthStatus.OK, glucose: 90 },
          respiratoryImmune: { status: HealthStatus.OK, spo2: 98, temp: 36.6 },
          sleepRecovery: { status: HealthStatus.OK, avgSleepHours7d: 8 },
          behavioral: { status: HealthStatus.OK, currentMood: 5 },
        },
        recentHistory7d: [],
        astronaut: astronautInfo,
        status: HealthStatus.OK,
        alertsSummary: [],
        totalReadingsCount: 0,
      };
    }

    // Calcular estado cardiovascular
    let cvStatus: HealthStatus = HealthStatus.OK;
    if (latest.heartRateBpm > 100 || latest.heartRateBpm < 40 || latest.systolicMmHg >= 140 || latest.diastolicMmHg >= 90) {
      cvStatus = HealthStatus.CRITICAL;
    } else if (latest.heartRateBpm > 90 || latest.systolicMmHg >= 130 || latest.diastolicMmHg >= 85) {
      cvStatus = HealthStatus.WARNING;
    }

    // Calcular estado metabólico
    let metaStatus: HealthStatus = HealthStatus.OK;
    if (latest.glucoseMgDl < 70 || latest.glucoseMgDl > 180) {
      metaStatus = HealthStatus.CRITICAL;
    } else if (latest.glucoseMgDl > 140) {
      metaStatus = HealthStatus.WARNING;
    }

    // Respiratorio e inmune
    let respStatus: HealthStatus = HealthStatus.OK;
    if (latest.spo2Pct < 92 || latest.temperatureC > 38.0 || latest.temperatureC < 35.5) {
      respStatus = HealthStatus.CRITICAL;
    } else if (latest.spo2Pct <= 94 || latest.temperatureC >= 37.6) {
      respStatus = HealthStatus.WARNING;
    }

    // Sueño y recuperación (promedio últimos 7 días)
    const totalSleepHours = recentHistory7d.reduce((sum, r) => sum + r.sleepHours, 0);
    const avgSleep =
      recentHistory7d.length > 0
        ? Number((totalSleepHours / recentHistory7d.length).toFixed(1))
        : latest.sleepHours;
    let sleepStatus: HealthStatus = HealthStatus.OK;
    if (avgSleep < 6.0) {
      sleepStatus = HealthStatus.CRITICAL;
    } else if (avgSleep < 7.0) {
      sleepStatus = HealthStatus.WARNING;
    }

    // Conductual / Ánimo
    let moodStatus: HealthStatus = HealthStatus.OK;
    if (latest.mood <= 2) {
      moodStatus = HealthStatus.CRITICAL;
    } else if (latest.mood === 3) {
      moodStatus = HealthStatus.WARNING;
    }

    return {
      astronautId: astronaut.id,
      astronautName: astronaut.name,
      missionName: astronaut.mission.name,
      currentStatus: latest.status,
      latestReading: latest,
      systems: {
        cardiovascular: {
          status: cvStatus,
          hr: latest.heartRateBpm,
          bp: `${latest.systolicMmHg}/${latest.diastolicMmHg}`,
        },
        metabolic: {
          status: metaStatus,
          glucose: latest.glucoseMgDl,
        },
        respiratoryImmune: {
          status: respStatus,
          spo2: latest.spo2Pct,
          temp: latest.temperatureC,
        },
        sleepRecovery: {
          status: sleepStatus,
          avgSleepHours7d: avgSleep,
        },
        behavioral: {
          status: moodStatus,
          currentMood: latest.mood,
        },
      },
      recentHistory7d,
      astronaut: astronautInfo,
      status: latest.status,
      alertsSummary: normalizeAlertMessages(latest.alerts),
      totalReadingsCount,
    };
  }
}
