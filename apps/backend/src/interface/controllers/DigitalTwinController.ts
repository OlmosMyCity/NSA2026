import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infrastructure/database/prismaClient.js";
import { radiationEngine } from "../../infrastructure/services/radiationEngine.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors/AppError.js";
import {
  evaluateDigitalTwin,
  simulateWhatIf,
  type TimedHealthReading,
} from "../../application/health/digitalTwin.js";
import { decide } from "../../application/health/decisionService.js";
import type {
  MissionEnvironment,
  NOAAStormScale,
  ShieldingType,
} from "../../application/health/hazards.js";

const EnvironmentSchema = z.enum([
  "SPACECRAFT",
  "STATION",
  "ROVER",
  "LUNAR_BASE",
  "MARS_BASE",
]);

const ShieldingSchema = z.enum([
  "EVA_SUIT",
  "CREW_CABIN_NOMINAL",
  "STORM_SHELTER",
]);

const StormScaleSchema = z.enum([
  "S0_NOMINAL",
  "S1_MINOR",
  "S2_MODERATE",
  "S3_STRONG",
  "S4_SEVERE",
  "S5_EXTREME",
]);

const ReadingSchema = z.object({
  heartRateBpm: z.number().finite(),
  systolicMmHg: z.number().finite(),
  diastolicMmHg: z.number().finite(),
  glucoseMgDl: z.number().finite(),
  temperatureC: z.number().finite(),
  spo2Pct: z.number().finite(),
  sleepHours: z.number().finite(),
  mood: z.number().finite(),
  resistanceExerciseMin: z.number().finite().nullable().optional(),
  takenAt: z.union([z.string(), z.date()]),
});

const InstrumentImageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z.string().min(1),
});

const SimulateBodySchema = z.object({
  environment: EnvironmentSchema.optional(),
  radiation: z
    .object({
      stormScale: StormScaleSchema.optional(),
      shielding: ShieldingSchema.optional(),
      fluxPfu: z.number().finite().optional(),
    })
    .optional(),
  readingOverrides: ReadingSchema.omit({ takenAt: true }).partial().optional(),
  freeTextMood: z.string().max(1000).optional(),
  instrumentImage: InstrumentImageSchema.optional(),
});

const EvaluateStatelessBodySchema = z.object({
  readings: z.array(ReadingSchema),
  environment: EnvironmentSchema.default("LUNAR_BASE"),
  radiation: z
    .object({
      stormScale: StormScaleSchema.default("S0_NOMINAL"),
      shielding: ShieldingSchema.default("CREW_CABIN_NOMINAL"),
      fluxPfu: z.number().finite().optional(),
    })
    .optional(),
  freeTextMood: z.string().max(1000).optional(),
  instrumentImage: InstrumentImageSchema.optional(),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(
      first ? `${first.path.join(".") || "body"}: ${first.message}` : "Datos inválidos."
    );
  }
  return parsed.data;
}

async function assertAstronautAccess(req: Request, astronautId: string): Promise<void> {
  if (!req.user || req.user.role === Role.ADMIN) return;
  const own = await prisma.astronaut.findFirst({
    where: { userId: req.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!own || own.id !== astronautId) {
    throw new ForbiddenError(
      "No tienes permiso para consultar el gemelo digital de otro tripulante."
    );
  }
}

async function loadAstronautTwinContext(astronautId: string) {
  const astronaut = await prisma.astronaut.findFirst({
    where: { id: astronautId, deletedAt: null },
    include: {
      mission: { select: { id: true, name: true, environment: true } },
      readings: {
        where: { isValid: true },
        orderBy: { takenAt: "desc" },
        take: 20,
      },
    },
  });

  if (!astronaut) {
    throw new NotFoundError("Astronauta", astronautId);
  }

  let stormScale: NOAAStormScale = "S0_NOMINAL";
  let radiationState: Awaited<ReturnType<typeof radiationEngine.getCurrentState>> | null = null;
  try {
    radiationState = await radiationEngine.getCurrentState();
    stormScale = radiationState.currentTelemetry.stormScale as NOAAStormScale;
  } catch {
    stormScale = "S0_NOMINAL";
  }

  const readings: TimedHealthReading[] = astronaut.readings.map((r) => ({
    heartRateBpm: r.heartRateBpm,
    systolicMmHg: r.systolicMmHg,
    diastolicMmHg: r.diastolicMmHg,
    glucoseMgDl: r.glucoseMgDl,
    temperatureC: r.temperatureC,
    spo2Pct: r.spo2Pct,
    sleepHours: r.sleepHours,
    mood: r.mood,
    takenAt: r.takenAt,
  }));

  return {
    astronaut: {
      id: astronaut.id,
      name: astronaut.name,
      role: astronaut.role,
      mission: astronaut.mission,
    },
    environment: (astronaut.mission?.environment ?? "LUNAR_BASE") as MissionEnvironment,
    readings,
    stormScale,
    radiationState,
  };
}

export class DigitalTwinController {
  getDigitalTwin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await assertAstronautAccess(req, id);

      const shieldingParam = req.query.shielding;
      const shielding: ShieldingType = ShieldingSchema.safeParse(shieldingParam).success
        ? (shieldingParam as ShieldingType)
        : "CREW_CABIN_NOMINAL";

      const ctx = await loadAstronautTwinContext(id);
      const twin = evaluateDigitalTwin({
        readings: ctx.readings,
        environment: ctx.environment,
        radiation: { stormScale: ctx.stormScale, shielding },
      });
      const decision = await decide(twin);

      res.status(200).json({
        astronaut: ctx.astronaut,
        twin,
        decision,
        radiation: ctx.radiationState,
      });
    } catch (error) {
      next(error);
    }
  };

  simulate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await assertAstronautAccess(req, id);

      const body = parseBody(SimulateBodySchema, req.body);
      const ctx = await loadAstronautTwinContext(id);

      const sim = simulateWhatIf(
        {
          readings: ctx.readings,
          environment: ctx.environment,
          radiation: {
            stormScale: ctx.stormScale,
            shielding: "CREW_CABIN_NOMINAL",
          },
        },
        {
          environment: body.environment,
          radiation: body.radiation,
          readingOverrides: body.readingOverrides,
        }
      );

      const decision = await decide(sim.projected, {
        freeTextMood: body.freeTextMood,
        instrumentImage: body.instrumentImage,
      });

      res.status(200).json({
        baseline: sim.baseline,
        projected: sim.projected,
        changedZones: sim.changedZones,
        decision,
      });
    } catch (error) {
      next(error);
    }
  };

  evaluateStateless = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const body = parseBody(EvaluateStatelessBodySchema, req.body);
      const twin = evaluateDigitalTwin({
        readings: body.readings,
        environment: body.environment ?? "LUNAR_BASE",
        radiation: body.radiation
          ? {
              stormScale: body.radiation.stormScale ?? "S0_NOMINAL",
              shielding: body.radiation.shielding ?? "CREW_CABIN_NOMINAL",
              fluxPfu: body.radiation.fluxPfu,
            }
          : undefined,
      });
      const decision = await decide(twin, {
        freeTextMood: body.freeTextMood,
        instrumentImage: body.instrumentImage,
      });

      res.status(200).json({ twin, decision });
    } catch (error) {
      next(error);
    }
  };
}
