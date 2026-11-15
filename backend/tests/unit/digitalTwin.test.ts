import { describe, it, expect } from "vitest";
import {
  evaluateDigitalTwin,
  simulateWhatIf,
  type TimedHealthReading,
} from "../../src/service/health/digitalTwin.js";
import { computeZoneHazardLoad } from "../../src/service/health/hazards.js";

const NOW = Date.parse("2026-11-14T12:00:00.000Z");

function hoursAgo(h: number): string {
  return new Date(NOW - h * 3_600_000).toISOString();
}

function makeNominalReading(hoursBack = 2, overrides: Partial<TimedHealthReading> = {}): TimedHealthReading {
  return {
    heartRateBpm: 70,
    systolicMmHg: 115,
    diastolicMmHg: 75,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 8,
    mood: 5,
    resistanceExerciseMin: 70,
    takenAt: hoursAgo(hoursBack),
    ...overrides,
  };
}

describe("hazards - Matriz 5 peligros HRP y perfiles de entorno", () => {
  it("MARS_BASE genera mayor carga de aislamiento/distancia en brain que STATION", () => {
    const mars = computeZoneHazardLoad("brain", "MARS_BASE");
    const station = computeZoneHazardLoad("brain", "STATION");

    expect(mars.total).toBeGreaterThan(station.total);
    expect(mars.breakdown.isolation).toBeGreaterThan(station.breakdown.isolation);
    expect(mars.breakdown.distance).toBeGreaterThan(station.breakdown.distance);
  });

  it("tormenta S4 en EVA_SUIT dispara carga de radiación en blood, y STORM_SHELTER la mitiga", () => {
    const eva = computeZoneHazardLoad("blood", "ROVER", {
      stormScale: "S4_SEVERE",
      shielding: "EVA_SUIT",
    });
    const shelter = computeZoneHazardLoad("blood", "ROVER", {
      stormScale: "S4_SEVERE",
      shielding: "STORM_SHELTER",
    });

    expect(eva.breakdown.radiation).toBeGreaterThan(0.8);
    expect(eva.topHazard).toBe("radiation");
    expect(shelter.breakdown.radiation).toBeLessThan(eva.breakdown.radiation * 0.4);
  });
});

describe("evaluateDigitalTwin - Motor determinista del Gemelo Digital", () => {
  it("clasifica todas las zonas como green y stable con lecturas nominales recientes", () => {
    const twin = evaluateDigitalTwin({
      readings: [makeNominalReading(2)],
      environment: "STATION",
      now: NOW,
    });

    expect(twin.overallStatus).toBe("green");
    expect(twin.overallRiskLevel).toBe("stable");
    expect(twin.overdueZones).toHaveLength(0);

    for (const z of Object.values(twin.zones)) {
      expect(z.status).toBe("green");
      expect(z.isOverdue).toBe(false);
    }
  });

  it("cubre bradicardia leve (40-49 lpm) e hipotermia leve (35.5-36.0 °C) como amber", () => {
    const twin = evaluateDigitalTwin({
      readings: [makeNominalReading(1, { heartRateBpm: 45, temperatureC: 35.8 })],
      environment: "STATION",
      now: NOW,
    });

    expect(twin.zones.heart.status).toBe("amber");
    expect(twin.zones.heart.riskLevel).toBe("elevated");
    expect(twin.zones.blood.status).toBe("amber");
    expect(twin.overallStatus).toBe("amber");
  });

  it("detecta mediciones vencidas por ventana (12h vitales, 24h sueño/ánimo, 48h ejercicio)", () => {
    const twin = evaluateDigitalTwin({
      readings: [makeNominalReading(15)], // >12h pero <24h
      environment: "STATION",
      now: NOW,
    });

    expect(twin.zones.heart.isOverdue).toBe(true);
    expect(twin.zones.blood.isOverdue).toBe(true);
    expect(twin.zones.sleep.isOverdue).toBe(false);
    expect(twin.zones.brain.isOverdue).toBe(false);
    expect(twin.zones.bones.isOverdue).toBe(false);
    expect(twin.zones.heart.riskLevel).toBe("watch");
  });

  it("marca zonas sin lecturas como unknown y vencidas", () => {
    const twin = evaluateDigitalTwin({
      readings: [],
      environment: "LUNAR_BASE",
      now: NOW,
    });

    expect(twin.overallStatus).toBe("unknown");
    expect(twin.overdueZones).toHaveLength(5);
  });

  it("calcula tendencias worsening e improving respecto a lecturas previas", () => {
    const worseningTwin = evaluateDigitalTwin({
      readings: [
        makeNominalReading(48, { heartRateBpm: 70, sleepHours: 8 }),
        makeNominalReading(24, { heartRateBpm: 72, sleepHours: 7.5 }),
        makeNominalReading(2, { heartRateBpm: 94, sleepHours: 5.5 }),
      ],
      environment: "SPACECRAFT",
      now: NOW,
    });

    expect(worseningTwin.zones.heart.trend).toBe("worsening");
    expect(worseningTwin.zones.sleep.trend).toBe("worsening");
    expect(worseningTwin.zones.sleep.riskLevel).toBe("critical");

    const improvingTwin = evaluateDigitalTwin({
      readings: [
        makeNominalReading(48, { heartRateBpm: 98, sleepHours: 5.5 }),
        makeNominalReading(24, { heartRateBpm: 94, sleepHours: 6.0 }),
        makeNominalReading(2, { heartRateBpm: 72, sleepHours: 7.8 }),
      ],
      environment: "SPACECRAFT",
      now: NOW,
    });

    expect(improvingTwin.zones.heart.trend).toBe("improving");
    expect(improvingTwin.zones.sleep.trend).toBe("improving");
  });

  it("escala amber a critical si la tendencia empeora con carga ambiental alta", () => {
    const twin = evaluateDigitalTwin({
      readings: [
        makeNominalReading(24, { spo2Pct: 98 }),
        makeNominalReading(2, { spo2Pct: 93 }), // amber + worsening
      ],
      environment: "ROVER",
      radiation: { stormScale: "S4_SEVERE", shielding: "EVA_SUIT" },
      now: NOW,
    });

    expect(twin.zones.blood.status).toBe("amber");
    expect(twin.zones.blood.trend).toBe("worsening");
    expect(twin.zones.blood.riskLevel).toBe("critical");
  });
});

describe("simulateWhatIf - Proyección hipotética sin mutar estado base", () => {
  it("proyecta cambios en entorno, radiación y signos vitales sin mutar lecturas originales", () => {
    const originalReading = makeNominalReading(2);
    const baseInput = {
      readings: [originalReading],
      environment: "STATION" as const,
      radiation: { stormScale: "S0_NOMINAL" as const, shielding: "CREW_CABIN_NOMINAL" as const },
      now: NOW,
    };

    const sim = simulateWhatIf(baseInput, {
      environment: "ROVER",
      radiation: { stormScale: "S4_SEVERE", shielding: "EVA_SUIT" },
      readingOverrides: { sleepHours: 4.5, heartRateBpm: 105 },
    });

    expect(sim.baseline.overallStatus).toBe("green");
    expect(sim.projected.overallStatus).toBe("red");
    expect(sim.changedZones).toEqual(expect.arrayContaining(["heart", "sleep", "blood"]));
    // Verifica no mutación
    expect(baseInput.readings[0].sleepHours).toBe(8);
    expect(baseInput.readings[0].heartRateBpm).toBe(70);
  });
});

