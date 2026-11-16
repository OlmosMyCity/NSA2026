import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import {
  classifyIndicator,
  evaluateReading,
  HEALTH_BANDS,
  type HealthReadingInput,
  type RuleIndicator,
} from "../../src/service/health/evaluateReading.js";

/**
 * El frontend muestra el semáforo (dashboard, tendencias, vista previa del asistente) con
 * una copia de HEALTH_BANDS. Este test falla si las dos tablas dejan de coincidir.
 * La ruta se resuelve en tiempo de ejecución para que tsc del backend no compile el frontend.
 */
// vitest se ejecuta desde backend (npm test).
const FRONTEND_EVALUATE = path.resolve(process.cwd(), "../frontend/src/domain/health/evaluate.ts");
const FRONTEND_PROTOCOLS = path.resolve(process.cwd(), "../frontend/src/domain/health/medicalProtocols.ts");

type FrontStatus = "green" | "amber" | "red" | "unknown";
interface FrontendRules {
  evaluateIndicator: (indicator: string, value: number) => { status: FrontStatus };
  evaluateVitals: (v: HealthReadingInput) => {
    status: string;
    alerts: Array<{ indicator: string; level: string; protocolId?: string }>;
  };
}
interface FrontendProtocols {
  MEDICAL_PROTOCOLS: Record<string, { steps: string[]; reference: string }>;
}

const TO_BACKEND: Record<FrontStatus, string> = { green: "OK", amber: "WARNING", red: "CRITICAL", unknown: "?" };

let front: FrontendRules;
let frontProtocols: FrontendProtocols;

beforeAll(async () => {
  front = (await import(FRONTEND_EVALUATE)) as FrontendRules;
  frontProtocols = (await import(FRONTEND_PROTOCOLS)) as FrontendProtocols;
});

/** Valores a probar: cada límite, ±0.05 alrededor y una rejilla fina del rango físico. */
function samples(indicator: RuleIndicator): number[] {
  const values = new Set<number>();
  for (const band of HEALTH_BANDS[indicator]) {
    for (const edge of [band.lt, band.lte]) {
      if (edge === undefined) continue;
      [edge - 0.05, edge, edge + 0.05].forEach((v) => values.add(Number(v.toFixed(2))));
    }
  }
  for (let v = 0; v <= 250; v += 0.5) values.add(v);
  return [...values];
}

describe("Paridad de reglas clínicas backend ↔ frontend", () => {
  for (const indicator of Object.keys(HEALTH_BANDS) as RuleIndicator[]) {
    it(`clasifica igual "${indicator}" en todo el rango`, () => {
      const mismatches = samples(indicator)
        .filter((v) => indicator !== "mood" || Number.isInteger(v))
        .filter((v) => TO_BACKEND[front.evaluateIndicator(indicator, v).status] !== classifyIndicator(indicator, v));
      expect(mismatches).toEqual([]);
    });
  }

  it("la vista previa del frontend da el mismo estado y alertas que evaluateReading", () => {
    let seed = 42;
    const rand = (min: number, max: number, decimals = 0) => {
      seed = (seed * 16807) % 2147483647;
      return Number((min + ((seed - 1) / 2147483646) * (max - min)).toFixed(decimals));
    };
    for (let i = 0; i < 500; i++) {
      const vitals: HealthReadingInput = {
        heartRateBpm: rand(35, 110),
        systolicMmHg: rand(85, 150),
        diastolicMmHg: rand(60, 95),
        glucoseMgDl: rand(60, 190),
        temperatureC: rand(35, 38.6, 1),
        spo2Pct: rand(89, 100),
        sleepHours: rand(4, 9, 1),
        mood: rand(1, 5),
      };
      const backend = evaluateReading(vitals);
      const frontend = front.evaluateVitals(vitals);
      expect(frontend.status).toBe(backend.status);
      expect(frontend.alerts.map((a) => [a.indicator, a.level, a.protocolId])).toEqual(
        backend.alerts.map((a) => [a.indicator, a.level, a.protocolId])
      );
      for (const alert of backend.alerts) {
        const guide = frontProtocols.MEDICAL_PROTOCOLS[alert.protocolId];
        expect(guide, `Missing guided protocol for ${alert.protocolId}`).toBeDefined();
        expect(guide.steps.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
