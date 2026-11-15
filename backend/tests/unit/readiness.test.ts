import { describe, it, expect } from "vitest";
import {
  DESTINATIONS,
  evaluateAllDestinations,
  evaluateReadiness,
  type Destination,
  type ReadinessVerdict,
} from "../../src/service/health/readiness.js";
import type { BodyZoneId } from "../../src/service/health/hazards.js";
import type { ZoneHealthStatus } from "../../src/service/health/digitalTwin.js";

type Zones = Record<BodyZoneId, ZoneHealthStatus>;

const zones = (overrides: Partial<Zones> = {}): Zones => ({
  heart: "green",
  brain: "green",
  blood: "green",
  bones: "green",
  sleep: "green",
  ...overrides,
});

const CONDITIONS: Record<string, Zones> = {
  green: zones(),
  recoveryAmber: zones({ sleep: "amber", bones: "amber" }),
  vitalAmber: zones({ heart: "amber" }),
  red: zones({ blood: "red" }),
};

// Una fila por destino: [verde, ámbar en sueño/huesos, ámbar vital, rojo]
const MATRIX: Record<Exclude<Destination, "STORM_SHELTER">, ReadinessVerdict[]> = {
  EVA: ["FIT", "FIT_WITH_CAUTION", "NOT_FIT", "NOT_FIT"],
  ROVER: ["FIT", "FIT_WITH_CAUTION", "FIT_WITH_CAUTION", "NOT_FIT"],
  HABITAT: ["FIT", "FIT", "FIT_WITH_CAUTION", "NOT_FIT"],
  MODULE_TRANSFER: ["FIT", "FIT", "FIT", "FIT_WITH_CAUTION"],
};

describe("evaluateReadiness", () => {
  for (const [destination, expected] of Object.entries(MATRIX)) {
    Object.keys(CONDITIONS).forEach((condition, i) => {
      it(`${destination} con ${condition} → ${expected[i]}`, () => {
        const result = evaluateReadiness(
          { zoneStatus: CONDITIONS[condition], isFresh: true },
          destination as Destination
        );
        expect(result.verdict).toBe(expected[i]);
      });
    });
  }

  it("con datos vencidos todo destino es NO_DATA, salvo el refugio", () => {
    const results = evaluateAllDestinations({ zoneStatus: zones(), isFresh: false });
    for (const r of results) {
      if (r.destination === "STORM_SHELTER") {
        expect(r).toMatchObject({ verdict: "FIT", reasonCode: "PROTECTIVE_SHELTER" });
      } else {
        expect(r).toMatchObject({ verdict: "NO_DATA", reasonCode: "READING_EXPIRED" });
      }
    }
  });

  it("el refugio es FIT incluso con un hallazgo crítico", () => {
    expect(evaluateReadiness({ zoneStatus: CONDITIONS.red, isFresh: true }, "STORM_SHELTER").verdict).toBe("FIT");
  });

  it("una zona vital sin datos impide el veredicto aunque la lectura sea vigente", () => {
    const result = evaluateReadiness({ zoneStatus: zones({ heart: "unknown" }), isFresh: true }, "HABITAT");
    expect(result.verdict).toBe("NO_DATA");
  });

  it("una zona no vital sin datos no bloquea", () => {
    const result = evaluateReadiness({ zoneStatus: zones({ bones: "unknown" }), isFresh: true }, "EVA");
    expect(result).toMatchObject({ verdict: "FIT", reasonCode: "ALL_NOMINAL" });
  });

  it("el rojo manda sobre el ámbar y lleva su motivo", () => {
    const result = evaluateReadiness(
      { zoneStatus: zones({ heart: "amber", sleep: "red" }), isFresh: true },
      "ROVER"
    );
    expect(result).toMatchObject({ verdict: "NOT_FIT", reasonCode: "CRITICAL_FINDING" });
  });

  it("devuelve un veredicto por cada destino", () => {
    const results = evaluateAllDestinations({ zoneStatus: zones(), isFresh: true });
    expect(results.map((r) => r.destination)).toEqual([...DESTINATIONS]);
  });
});
