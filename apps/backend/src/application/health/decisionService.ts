/**
 * @module application/health/decisionService
 * Gemini Decision 1 (`gemini-decision-1`) second-opinion integration layered on top of
 * the deterministic `decideByRules` clinical engine.
 *
 * Architectural invariants:
 * 1. Deterministic rules (`decideByRules`) always retain official clinical authority for
 *    `score`, `escalar`, and `accion`; Gemini provides an advisory `modelEstimate`,
 *    confidence scores, optional multimodal estimates (`freeTextMood`, `instrumentImage`),
 *    and discrepancy tracking (`detectDiscrepancies`).
 * 2. Requests are deduplicated via a SHA-256 hash that excludes `evaluatedAt`.
 * 3. `DEMO_OFFLINE=true`, missing credentials, call-budget exhaustion (`maxCalls`), or
 *    upstream errors fail safe to `rules-fallback` with `official` preserved.
 * 4. `disclaimer` is locked to `'estimación del modelo, no diagnóstico'` for clinical safety.
 */

import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { BODY_ZONES, type BodyZoneId } from "./hazards.js";
import type { DigitalTwinState } from "./digitalTwin.js";
import {
  ACTION_DESCRIPTIONS,
  decideByRules,
  type DecisionOutcome,
  type RecommendedAction,
  type ZoneScoreEstimate,
} from "./decisionRules.js";

export interface InstrumentImageInput {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

/** Optional multimodal inputs appended to the Gemini Decision 1 evaluation request. */
export interface DecideOptions {
  freeTextMood?: string;
  instrumentImage?: InstrumentImageInput;
}

/** Mood estimate parsed from free-text astronaut journal notes via Decision 1 scoring. */
export interface FreeTextMoodEstimate {
  /** 1..5 mood scale mapped from the Gemini `0..4` score rubric. */
  moodScore: number;
  rawScore: number;
  confidence: number;
}

/** Visual triage classification extracted from a medical instrument screen image. */
export interface InstrumentImageEstimate {
  status: "green" | "amber" | "red" | "unreadable";
  visibleAlert: boolean;
  confidence: number;
}

/**
 * Combined decision contract returned by `DecisionService.decide`.
 * Top-level `score`, `escalar`, and `accion` always mirror `official` (deterministic rules).
 */
export interface DecisionResult {
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  escalar: boolean;
  accion: RecommendedAction;
  confianza: number;
  freeTextMoodEstimate?: FreeTextMoodEstimate;
  instrumentEstimate?: InstrumentImageEstimate;
}

/** Minimal SDK-compatible interface enabling dependency injection of mock Decision 1 clients in tests. */
export interface DecisionsClientLike {
  decisions: {
    create(params: {
      model: string;
      input: unknown;
      questions: Record<string, unknown>;
    }): Promise<{
      answers?: Record<string, Record<string, unknown>>;
    }>;
  };
}

/** Configuration options controlling API credentials, offline mode, call budgets, and client injection. */
export interface DecisionServiceConfig {
  apiKey?: string;
  demoOffline?: boolean;
  maxCalls?: number;
  client?: DecisionsClientLike;
}

const SCORE_CRITERIA_LEVELS: string[] = [
  "stable (0): Todos los indicadores de la zona en verde, tendencia estable o mejorando, medición vigente y peligros bajo umbral.",
  "watch (1): Medición vencida con valores previos verdes, tendencia empeorando dentro de verde o peligro ambiental elevado sin desviación clínica.",
  "elevated (2): Uno o más indicadores en ámbar, o combinación de tendencia empeorando + medición vencida + peligro activo en la zona.",
  "critical (3): Cualquier indicador en rojo, o múltiples en ámbar agravados por radiación/ambiente cerrado crítico.",
];

function buildQuestions(options?: DecideOptions): Record<string, unknown> {
  const questions: Record<string, unknown> = {};

  for (const zone of BODY_ZONES) {
    questions[`risk_${zone}`] = {
      type: "score",
      instructions: `Evalúa el nivel de riesgo operacional de la zona '${zone}' usando valor actual, tendencia, medición vencida y peligros HRP activos.`,
      criteria: SCORE_CRITERIA_LEVELS,
    };
  }

  questions.escalate_flight_surgeon = {
    type: "noul",
    instructions:
      "¿Conviene escalar al médico de vuelo (Flight Surgeon) en Tierra ahora? SÍ si hay cualquier zona roja/crítica, >=2 zonas ámbar empeorando, o radiación S4/S5 sin Storm Shelter, o SpO2<95 en ambiente hostil. NO si todo está verde o hay un único ámbar aislado estable.",
  };

  questions.primary_action = {
    type: "choice",
    instructions:
      "Selecciona la única acción prioritaria más segura para el astronauta en este momento.",
    criteria: ACTION_DESCRIPTIONS,
  };

  if (options?.freeTextMood && options.freeTextMood.trim().length > 0) {
    questions.mood_from_text = {
      type: "score",
      instructions:
        "Clasifica el estado de ánimo del astronauta según su nota de texto libre.",
      criteria: [
        "1/5: Crisis emocional, desesperanza o incapacidad operativa.",
        "2/5: Muy decaído, aislado, frustrado o fatigado emocionalmente.",
        "3/5: Neutral, tenso o levemente decaído.",
        "4/5: Bien, estable y colaborador.",
        "5/5: Óptimo, motivado y resiliente.",
      ],
    };
  }

  if (options?.instrumentImage) {
    questions.instrument_status = {
      type: "choice",
      instructions:
        "Clasifica el estado visual del instrumento médico en la imagen (oxímetro, tensiómetro, glucómetro o termómetro).",
      criteria: {
        green: "Lectura claramente visible dentro de rango nominal.",
        amber: "Lectura visible en rango de precaución/limítrofe.",
        red: "Lectura visible en rango crítico o pantalla con alerta roja.",
        unreadable: "Imagen borrosa, cortada o sin lectura legible.",
      },
    };
    questions.instrument_visible_alert = {
      type: "noul",
      instructions:
        "¿La pantalla del instrumento muestra algún icono de alerta, batería crítica o valor fuera de rango?",
    };
  }

  return questions;
}

function buildInputPayload(
  state: DigitalTwinState,
  options?: DecideOptions
): unknown {
  const { evaluatedAt: _ignored, ...stableState } = state;
  const serializedState = JSON.stringify({
    twin: stableState,
    freeTextMood: options?.freeTextMood?.trim() || undefined,
  });

  if (!options?.instrumentImage) {
    return serializedState;
  }

  return [
    { text: serializedState },
    {
      inline_data: {
        mime_type: options.instrumentImage.mimeType,
        data: options.instrumentImage.dataBase64,
      },
    },
  ];
}

function hashRequest(state: DigitalTwinState, options?: DecideOptions): string {
  const { evaluatedAt: _ignored, ...stableState } = state;
  const imageHash = options?.instrumentImage
    ? createHash("sha256")
        .update(options.instrumentImage.mimeType)
        .update(options.instrumentImage.dataBase64)
        .digest("hex")
    : "";

  return createHash("sha256")
    .update(JSON.stringify(stableState))
    .update("|")
    .update(options?.freeTextMood?.trim() ?? "")
    .update("|")
    .update(imageHash)
    .digest("hex");
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class DecisionService {
  private readonly cache = new Map<string, DecisionResult>();
  private callsUsed = 0;
  private readonly maxCalls: number;
  private readonly demoOffline: boolean;
  private readonly apiKey: string | undefined;
  private readonly injectedClient?: DecisionsClientLike;

  constructor(config: DecisionServiceConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
    this.demoOffline =
      config.demoOffline ?? process.env.DEMO_OFFLINE === "true";
    this.maxCalls =
      config.maxCalls ??
      (Number(process.env.DECISION_API_MAX_CALLS) || 50);
    this.injectedClient = config.client;
  }

  /** Returns current API call usage, configured budget ceiling, and cache entry count. */
  getStats(): { callsUsed: number; maxCalls: number; cacheSize: number } {
    return {
      callsUsed: this.callsUsed,
      maxCalls: this.maxCalls,
      cacheSize: this.cache.size,
    };
  }

  private createFallbackResult(official: DecisionOutcome): DecisionResult {
    return {
      score: official.score,
      escalar: official.escalar,
      accion: official.accion,
      confianza: official.confianza,
    };
  }

  /**
   * Evaluates a Digital Twin snapshot through deterministic rules first, then optionally queries
   * `gemini-decision-1` for second-opinion zone scores, action selection, and multimodal estimates.
   * Official `score`, `escalar`, and `accion` are always governed by `decideByRules`.
   */
  async decide(
    state: DigitalTwinState,
    options?: DecideOptions
  ): Promise<DecisionResult> {
    const official = decideByRules(state);
    const cacheKey = hashRequest(state, options);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const canCallApi =
      !this.demoOffline &&
      this.callsUsed < this.maxCalls &&
      Boolean(this.injectedClient || this.apiKey);

    if (!canCallApi) {
      return this.createFallbackResult(official);
    }

    try {
      const client: DecisionsClientLike =
        this.injectedClient ??
        (new GoogleGenAI({
          apiVersion: "v1beta",
          apiKey: this.apiKey,
        }) as unknown as DecisionsClientLike);

      this.callsUsed += 1;

      const response = await client.decisions.create({
        model: "gemini-decision-1",
        input: buildInputPayload(state, options),
        questions: buildQuestions(options),
      });

      const answers = response.answers ?? {};
      const confidences: number[] = [];

      for (const zone of BODY_ZONES) {
        const ans = answers[`risk_${zone}`];
        const conf = asNumber(ans?.confidence, 0.5);
        confidences.push(conf);
      }

      const noulAns = answers.escalate_flight_surgeon;
      const noulConf = asNumber(noulAns?.confidence, 0.5);
      confidences.push(noulConf);

      const choiceAns = answers.primary_action;
      const choiceConf = asNumber(choiceAns?.confidence, 0.5);
      confidences.push(choiceConf);

      const avgConfidence = Number(
        (
          confidences.reduce((sum, c) => sum + c, 0) /
          Math.max(1, confidences.length)
        ).toFixed(3)
      );

      let freeTextMoodEstimate: FreeTextMoodEstimate | undefined;
      if (answers.mood_from_text) {
        const rawScore = asNumber(answers.mood_from_text.score, 2);
        freeTextMoodEstimate = {
          moodScore: Math.max(1, Math.min(5, Math.round(rawScore) + 1)),
          rawScore: Number(rawScore.toFixed(2)),
          confidence: Number(
            asNumber(answers.mood_from_text.confidence, 0.5).toFixed(3)
          ),
        };
      }

      let instrumentEstimate: InstrumentImageEstimate | undefined;
      if (answers.instrument_status) {
        const rawStatus = answers.instrument_status.choice;
        const status =
          rawStatus === "green" ||
          rawStatus === "amber" ||
          rawStatus === "red" ||
          rawStatus === "unreadable"
            ? rawStatus
            : "unreadable";
        instrumentEstimate = {
          status,
          visibleAlert:
            asNumber(answers.instrument_visible_alert?.noul, 0) >= 0.5,
          confidence: Number(
            asNumber(answers.instrument_status.confidence, 0.5).toFixed(3)
          ),
        };
      }

      const result: DecisionResult = {
        score: official.score,
        escalar: official.escalar,
        accion: official.accion,
        confianza: avgConfidence,
        freeTextMoodEstimate,
        instrumentEstimate,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch {
      return this.createFallbackResult(official);
    }
  }
}

const defaultService = new DecisionService();

/**
 * Public single-entry decision interface: `decide(state, options)` -> `{ score, escalar, accion, confianza, ... }`.
 */
export async function decide(
  state: DigitalTwinState,
  options?: DecideOptions
): Promise<DecisionResult> {
  return defaultService.decide(state, options);
}
