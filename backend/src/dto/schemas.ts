/**
 * @module schemas
 * Zod request validation schemas and helper parsers for missions, astronauts,
 * physiological readings, vision telemetry, biodosimetry, incidents, and directives.
 */

import { Environment, IncidentCategory, IncidentSeverity, MissionStatus } from "@prisma/client";
import { z } from "zod";
import { ValidationError } from "../exception/AppError.js";

/**
 * Parses non-empty numeric strings while preventing `""`, `null`, or `boolean` values
 * from implicitly coercing to `0` (also handles multipart string fields).
 */
function finiteNumber(
  label: string,
  min: number,
  max: number,
  options: { int?: boolean } = {}
) {
  return z.preprocess(
    (val) => {
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed === "" ? NaN : Number(trimmed);
      }
      if (typeof val === "boolean" || val === null) return NaN;
      return val;
    },
    (options.int
      ? z.number({ message: `'${label}' debe ser un número válido.` }).int(`'${label}' debe ser un entero.`)
      : z.number({ message: `'${label}' debe ser un número válido.` })
    )
      .finite(`'${label}' debe ser un número finito.`)
      .min(min, `'${label}' debe ser mayor o igual a ${min}.`)
      .max(max, `'${label}' debe ser menor o igual a ${max}.`)
  );
}

/**
 * Validates optional image URLs, allowing only `https:` URLs or `null`.
 * Preserves `undefined` so partial PATCH/PUT payloads do not overwrite stored values.
 */
export const safeImageUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (val) => {
      if (val === undefined || val === null) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "La URL de imagen debe usar protocolo HTTPS válido." }
  );

const requiredNonEmptyString = (label: string, maxLen: number) =>
  z
    .string({ message: `El campo '${label}' es obligatorio.` })
    .trim()
    .min(1, `El campo '${label}' no puede estar vacío.`)
    .max(maxLen, `El campo '${label}' no puede exceder ${maxLen} caracteres.`);

const optionalDateSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val, ctx) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Formato de fecha inválido." });
      return z.NEVER;
    }
    return date;
  });

const healthVitalsShape = {
  heartRateBpm: finiteNumber("heartRateBpm", 20, 260, { int: true }),
  systolicMmHg: finiteNumber("systolicMmHg", 40, 300, { int: true }),
  diastolicMmHg: finiteNumber("diastolicMmHg", 20, 200, { int: true }),
  glucoseMgDl: finiteNumber("glucoseMgDl", 15, 1000),
  temperatureC: finiteNumber("temperatureC", 25, 45),
  spo2Pct: finiteNumber("spo2Pct", 30, 100),
  sleepHours: finiteNumber("sleepHours", 0, 24),
  mood: finiteNumber("mood", 1, 5, { int: true }),
  notes: z.string().trim().max(1000, "Las notas no pueden exceder 1000 caracteres.").nullable().optional(),
  takenAt: optionalDateSchema,
};

/** Schema for creating a physiological health reading within safe clinical bounds. */
export const createHealthReadingSchema = z.object({
  astronautId: requiredNonEmptyString("astronautId", 128),
  ...healthVitalsShape,
});

// P1: las lecturas no se editan. Se invalidan con motivo o se corrigen con una lectura nueva.
const readingChangeReason = z
  .string({ required_error: "El motivo es obligatorio." })
  .trim()
  .min(5, "El motivo debe tener al menos 5 caracteres.")
  .max(500, "El motivo no puede exceder 500 caracteres.");

export const invalidateHealthReadingSchema = z.object({
  reason: readingChangeReason,
});

export const correctHealthReadingSchema = z.object({
  ...healthVitalsShape,
  reason: readingChangeReason,
});

/** Schema for creating a mission with chronological `startDate` <= `endDate` enforcement. */
export const createMissionSchema = z
  .object({
    name: requiredNonEmptyString("name", 200),
    description: requiredNonEmptyString("description", 4000),
    environment: z.nativeEnum(Environment).optional(),
    status: z.nativeEnum(MissionStatus).optional(),
    startDate: z
      .union([z.string(), z.date()], {
        message: "El campo 'startDate' es obligatorio y debe ser una fecha válida.",
      })
      .transform((val, ctx) => {
        const date = val instanceof Date ? val : new Date(val);
        if (isNaN(date.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El formato de 'startDate' no es una fecha válida.",
          });
          return z.NEVER;
        }
        return date;
      }),
    endDate: optionalDateSchema,
    patchUrl: safeImageUrlSchema.optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "La fecha de fin ('endDate') no puede ser anterior a 'startDate'.",
  });

export const updateMissionSchema = z.object({
  name: requiredNonEmptyString("name", 200).optional(),
  description: requiredNonEmptyString("description", 4000).optional(),
  environment: z.nativeEnum(Environment).optional(),
  status: z.nativeEnum(MissionStatus).optional(),
  startDate: z
    .union([z.string(), z.date(), z.undefined()])
    .transform((val, ctx) => {
      if (val === undefined) return undefined;
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El formato de 'startDate' no es válido." });
        return z.NEVER;
      }
      return d;
    }),
  endDate: optionalDateSchema,
  patchUrl: safeImageUrlSchema.optional(),
});

export const createAstronautSchema = z.object({
  name: requiredNonEmptyString("name", 200),
  role: requiredNonEmptyString("role", 120),
  age: finiteNumber("age", 1, 120, { int: true }),
  missionId: requiredNonEmptyString("missionId", 128),
  userId: z.string().trim().min(1).max(128).nullable().optional(),
  photoUrl: safeImageUrlSchema.optional(),
});

export const updateAstronautSchema = z.object({
  name: requiredNonEmptyString("name", 200).optional(),
  role: requiredNonEmptyString("role", 120).optional(),
  age: finiteNumber("age", 1, 120, { int: true }).optional(),
  missionId: requiredNonEmptyString("missionId", 128).optional(),
  userId: z.string().trim().min(1).max(128).nullable().optional(),
  photoUrl: safeImageUrlSchema.optional(),
});

/** Schema for clinical directives transmitted from flight surgeons to crew consoles. */
export const directivesSchema = z.object({
  directives: requiredNonEmptyString("directives", 2000),
  incidentId: z.string().trim().min(1).max(128).nullable().optional(),
});

/** Schema for selecting or resetting a deterministic solar radiation simulation scenario. */
export const radiationSimulateSchema = z.object({
  scenario: z
    .enum(["NOMINAL", "FLARE_EARLY_WARNING", "PEAK_STORM_S4", "SIDE_MISS_CME", "RESET"])
    .optional(),
});

/** Schema for biodosimetry triage requests combining shielding, vitals, radiation state, and biomarkers. */
export const biodosimetryTriageSchema = z.object({
  astronautId: z.string().trim().min(1).max(128).optional(),
  shieldingType: z.enum(["EVA_SUIT", "CREW_CABIN_NOMINAL", "STORM_SHELTER"]).optional(),
  healthReading: z.record(z.unknown()).optional(),
  radiationState: z.record(z.unknown()).optional(),
  biomarkers: z
    .object({
      gammaH2axFociPerCell: finiteNumber("gammaH2axFociPerCell", 0, 50).optional(),
      urine8OhdgNgMg: finiteNumber("urine8OhdgNgMg", 0, 200).optional(),
      fdxrFoldChange: finiteNumber("fdxrFoldChange", 0.1, 30).optional(),
    })
    .optional(),
});

export const openIncidentSchema = z.object({
  category: z.nativeEnum(IncidentCategory).optional(),
  type: requiredNonEmptyString("type", 100),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  astronautId: z.string().trim().min(1).max(128).nullable().optional(),
  missionId: z.string().trim().min(1).max(128).nullable().optional(),
  source: z.string().trim().min(1).max(100).default("MANUAL"),
  protocolId: z.string().trim().min(1).max(100).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const closeIncidentSchema = z.object({
  resolutionNotes: z.string().trim().max(2000).nullable().optional(),
});

/** Schema for edge camera/rPPG vision telemetry ingestion payloads. */
export const visionIngestSchema = z.object({
  astronautId: requiredNonEmptyString("astronautId", 128),
  heartRateBpm: finiteNumber("heartRateBpm", 0, 260),
  mood: finiteNumber("mood", 1, 5, { int: true }).optional(),
  moodValence: finiteNumber("moodValence", -1, 1).optional(),
  stressIndex: finiteNumber("stressIndex", 0, 100).optional(),
  alertnessScore: finiteNumber("alertnessScore", 0, 100).optional(),
  dominantMood: z.string().trim().max(120).optional(),
  sleepHours: finiteNumber("sleepHours", 0, 24).optional(),
  sleepQualityScore: finiteNumber("sleepQualityScore", 0, 100).optional(),
  perclos: finiteNumber("perclos", 0, 100).optional(),
  hrvRmssdMs: finiteNumber("hrvRmssdMs", 0, 1000).optional(),
  respirationRpm: finiteNumber("respirationRpm", 0, 100).optional(),
  signalQuality: finiteNumber("signalQuality", 0, 100).optional(),
  overallHealthIndex: finiteNumber("overallHealthIndex", 0, 100).optional(),
  cameraMode: z.string().trim().max(40).optional(),
  context: z.string().trim().max(40).optional(),
  fatigueLevel: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  takenAt: optionalDateSchema,
});

/**
 * Parses an unknown input object against a Zod schema and translates the first
 * validation issue into a `ValidationError` (HTTP 400).
 */
export function parseWithValidation<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ValidationError(first?.message || "Los datos proporcionados no son válidos.");
  }
  return result.data as z.output<TSchema>;
}
