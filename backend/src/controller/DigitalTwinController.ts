/**
 * @module DigitalTwinController
 * HTTP controller for physiological digital-twin evaluation, counterfactual "what-if"
 * mission simulations, and stateless multimodal decision analysis.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { LoadDigitalTwinContextUseCase } from "../service/health/LoadDigitalTwinContextUseCase.js";
import { ValidationError } from "../exception/AppError.js";
import {
  evaluateDigitalTwin,
  simulateWhatIf,
} from "../service/health/digitalTwin.js";
import { decide } from "../service/health/decisionService.js";
import type { ShieldingType } from "../service/health/hazards.js";

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
      first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid data."
    );
  }
  return parsed.data;
}

/**
 * Controller exposing live digital-twin state, what-if projections, and stateless evaluation endpoints.
 */
export class DigitalTwinController {
  constructor(private readonly twinContext: LoadDigitalTwinContextUseCase) {}

  /** `GET /api/astronauts/:id/digital-twin` — Evaluates current physiological zones and AI clinical decision. */
  getDigitalTwin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.twinContext.assertAccess(req.user, id);

      const shieldingParam = req.query.shielding;
      const shielding: ShieldingType = ShieldingSchema.safeParse(shieldingParam).success
        ? (shieldingParam as ShieldingType)
        : "CREW_CABIN_NOMINAL";

      const ctx = await this.twinContext.load(id);
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

  /** `POST /api/astronauts/:id/simulate` — Projects counterfactual vital/radiation overrides against baseline. */
  simulate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.twinContext.assertAccess(req.user, id);

      const body = parseBody(SimulateBodySchema, req.body);
      const ctx = await this.twinContext.load(id);

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

  /** `POST /api/astronauts/digital-twin/evaluate` — Stateless digital-twin & multimodal evaluation from supplied readings. */
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
