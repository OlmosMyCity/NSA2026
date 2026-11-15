import { describe, it, expect, vi } from "vitest";
import {
  evaluateDigitalTwin,
  type DigitalTwinState,
  type TimedHealthReading,
} from "../../src/application/health/digitalTwin.js";
import { decideByRules } from "../../src/application/health/decisionRules.js";
import {
  DecisionService,
  type DecisionsClientLike,
} from "../../src/application/health/decisionService.js";

const NOW = Date.parse("2026-11-14T13:00:00.000Z");

function makeReading(
  hoursBack = 1,
  overrides: Partial<TimedHealthReading> = {}
): TimedHealthReading {
  return {
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 8,
    mood: 5,
    resistanceExerciseMin: 65,
    takenAt: new Date(NOW - hoursBack * 3_600_000).toISOString(),
    ...overrides,
  };
}

function makeState(
  readingOverrides: Partial<TimedHealthReading> = {},
  hoursBack = 1,
  env: DigitalTwinState["environment"] = "STATION",
  stormScale: DigitalTwinState["radiation"]["stormScale"] = "S0_NOMINAL",
  shielding: DigitalTwinState["radiation"]["shielding"] = "CREW_CABIN_NOMINAL"
): DigitalTwinState {
  return evaluateDigitalTwin({
    readings: [makeReading(hoursBack, readingOverrides)],
    environment: env,
    radiation: { stormScale, shielding },
    now: NOW,
  });
}

function makeMockClient(
  answers: Record<string, Record<string, unknown>>
): { client: DecisionsClientLike; createMock: ReturnType<typeof vi.fn> } {
  const createMock = vi.fn().mockResolvedValue({ answers });
  return {
    client: { decisions: { create: createMock } },
    createMock,
  };
}

describe("decideByRules - Motor determinista de triaje", () => {
  it("retorna no_action y escalar=false en estado nominal", () => {
    const outcome = decideByRules(makeState());
    expect(outcome.escalar).toBe(false);
    expect(outcome.accion).toBe("no_action");
    expect(outcome.confianza).toBe(1);
  });

  it("retorna contact_ground y escalar=true cuando hay zona en rojo", () => {
    const outcome = decideByRules(makeState({ spo2Pct: 89 }));
    expect(outcome.escalar).toBe(true);
    expect(outcome.accion).toBe("contact_ground");
  });

  it("retorna shelter_shielding y escalar=true en tormenta S4 sin Storm Shelter", () => {
    const outcome = decideByRules(
      makeState({}, 1, "ROVER", "S4_SEVERE", "EVA_SUIT")
    );
    expect(outcome.escalar).toBe(true);
    expect(outcome.accion).toBe("shelter_shielding");
  });

  it("retorna re_measure cuando hay medición vencida", () => {
    const outcome = decideByRules(makeState({}, 16));
    expect(outcome.escalar).toBe(false);
    expect(outcome.accion).toBe("re_measure");
  });

  it("retorna rest cuando solo sueño está en ámbar", () => {
    const outcome = decideByRules(makeState({ sleepHours: 6.4 }));
    expect(outcome.escalar).toBe(false);
    expect(outcome.accion).toBe("rest");
  });

  it("retorna exercise cuando solo bones está en ámbar", () => {
    const outcome = decideByRules(makeState({ resistanceExerciseMin: 40 }));
    expect(outcome.escalar).toBe(false);
    expect(outcome.accion).toBe("exercise");
  });
});

describe("DecisionService - Evaluación clínica, caché, tope y fallback", () => {
  it("integra evaluación oficial y confianza", async () => {
    const { client, createMock } = makeMockClient({
      risk_heart: { score: 0.1, confidence: 0.94 },
      risk_brain: { score: 0.1, confidence: 0.92 },
      risk_blood: { score: 0.1, confidence: 0.95 },
      risk_bones: { score: 0.1, confidence: 0.91 },
      risk_sleep: { score: 0.1, confidence: 0.93 },
      escalate_flight_surgeon: { noul: 0.03, confidence: 0.97 },
      primary_action: { choice: "no_action", confidence: 0.96 },
    });

    const service = new DecisionService({ client, maxCalls: 10 });
    const result = await service.decide(makeState());

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.escalar).toBe(false);
    expect(result.accion).toBe("no_action");
    expect(result.confianza).toBeGreaterThan(0.9);
    const raw = result as unknown as Record<string, unknown>;
    expect(raw.discrepancy).toBeUndefined();
    expect(raw.modelEstimate).toBeUndefined();
    expect(raw.source).toBeUndefined();
    expect(raw.disclaimer).toBeUndefined();
  });

  it("prevalece siempre la decisión clínica de reglas sin exponer discrepancias internas", async () => {
    const { client } = makeMockClient({
      risk_heart: { score: 0.2, confidence: 0.85 },
      risk_brain: { score: 0.2, confidence: 0.85 },
      risk_blood: { score: 0.2, confidence: 0.85 },
      risk_bones: { score: 0.2, confidence: 0.85 },
      risk_sleep: { score: 0.2, confidence: 0.85 },
      escalate_flight_surgeon: { noul: 0.15, confidence: 0.85 },
      primary_action: { choice: "no_action", confidence: 0.85 },
    });

    const criticalState = makeState({ heartRateBpm: 120 }); // regla = red / contact_ground
    const service = new DecisionService({ client });
    const result = await service.decide(criticalState);

    expect(result.escalar).toBe(true);
    expect(result.accion).toBe("contact_ground");
    const raw = result as unknown as Record<string, unknown>;
    expect(raw.discrepancy).toBeUndefined();
    expect(raw.modelEstimate).toBeUndefined();
  });

  it("usa caché por hash del estado e ignora evaluatedAt volátil", async () => {
    const { client, createMock } = makeMockClient({
      risk_heart: { score: 0.1, confidence: 0.9 },
      risk_brain: { score: 0.1, confidence: 0.9 },
      risk_blood: { score: 0.1, confidence: 0.9 },
      risk_bones: { score: 0.1, confidence: 0.9 },
      risk_sleep: { score: 0.1, confidence: 0.9 },
      escalate_flight_surgeon: { noul: 0.05, confidence: 0.95 },
      primary_action: { choice: "no_action", confidence: 0.95 },
    });

    const service = new DecisionService({ client });
    const s1 = makeState();
    const s2 = { ...s1, evaluatedAt: "2026-11-14T13:05:00.000Z" };

    const r1 = await service.decide(s1);
    const r2 = await service.decide(s2);

    expect(r2).toEqual(r1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("respeta el tope de llamadas y evalúa por reglas al superarlo", async () => {
    const { client, createMock } = makeMockClient({
      risk_heart: { score: 0.1, confidence: 0.9 },
      risk_brain: { score: 0.1, confidence: 0.9 },
      risk_blood: { score: 0.1, confidence: 0.9 },
      risk_bones: { score: 0.1, confidence: 0.9 },
      risk_sleep: { score: 0.1, confidence: 0.9 },
      escalate_flight_surgeon: { noul: 0.05, confidence: 0.95 },
      primary_action: { choice: "no_action", confidence: 0.95 },
    });

    const service = new DecisionService({ client, maxCalls: 1 });
    const r1 = await service.decide(makeState());
    const r2 = await service.decide(makeState({ mood: 2 }));

    expect(r1.confianza).toBeCloseTo(0.914, 2);
    expect(r2.escalar).toBe(true);
    expect(r2.confianza).toBe(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("evalúa de forma determinista cuando demoOffline=true o cuando la API falla", async () => {
    const failingClient: DecisionsClientLike = {
      decisions: {
        create: vi.fn().mockRejectedValue(new Error("API timeout")),
      },
    };

    const offlineService = new DecisionService({
      client: failingClient,
      demoOffline: true,
    });
    const rOffline = await offlineService.decide(makeState({ spo2Pct: 88 }));
    expect(rOffline.escalar).toBe(true);
    expect(rOffline.confianza).toBe(1);

    const errorService = new DecisionService({
      client: failingClient,
      demoOffline: false,
    });
    const rError = await errorService.decide(makeState({ spo2Pct: 88 }));
    expect(rError.escalar).toBe(true);
    expect(rError.confianza).toBe(1);
  });

  it("procesa entradas libres de texto de ánimo e imagen de instrumento", async () => {
    const { client } = makeMockClient({
      risk_heart: { score: 0.1, confidence: 0.9 },
      risk_brain: { score: 1.8, confidence: 0.88 },
      risk_blood: { score: 0.1, confidence: 0.9 },
      risk_bones: { score: 0.1, confidence: 0.9 },
      risk_sleep: { score: 0.1, confidence: 0.9 },
      escalate_flight_surgeon: { noul: 0.1, confidence: 0.9 },
      primary_action: { choice: "rest", confidence: 0.89 },
      mood_from_text: { score: 1.1, confidence: 0.87 },
      instrument_status: { choice: "amber", confidence: 0.84 },
      instrument_visible_alert: { noul: 0.72, confidence: 0.8 },
    });

    const service = new DecisionService({ client });
    const result = await service.decide(makeState(), {
      freeTextMood: "Me siento muy aislado y agotado tras la guardia.",
      instrumentImage: { mimeType: "image/png", dataBase64: "ZmFrZQ==" },
    });

    expect(result.freeTextMoodEstimate).toEqual({
      moodScore: 2,
      rawScore: 1.1,
      confidence: 0.87,
    });
    expect(result.instrumentEstimate).toEqual({
      status: "amber",
      visibleAlert: true,
      confidence: 0.84,
    });
  });
});

