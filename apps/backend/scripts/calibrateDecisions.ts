import {
  evaluateDigitalTwin,
  type DigitalTwinState,
  type TimedHealthReading,
} from "../src/application/health/digitalTwin.js";
import { decideByRules } from "../src/application/health/decisionRules.js";
import { DecisionService } from "../src/application/health/decisionService.js";
import {
  BODY_ZONES,
  type MissionEnvironment,
  type NOAAStormScale,
  type ShieldingType,
} from "../src/application/health/hazards.js";

const NOW = Date.parse("2026-11-14T17:00:00.000Z");

interface CalibrationCase {
  id: string;
  description: string;
  state: DigitalTwinState;
}

function reading(
  hoursBack: number,
  overrides: Partial<TimedHealthReading> = {}
): TimedHealthReading {
  return {
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.8,
    mood: 5,
    resistanceExerciseMin: 65,
    takenAt: new Date(NOW - hoursBack * 3_600_000).toISOString(),
    ...overrides,
  };
}

function buildCase(
  id: string,
  description: string,
  opts: {
    readings?: TimedHealthReading[];
    environment?: MissionEnvironment;
    stormScale?: NOAAStormScale;
    shielding?: ShieldingType;
  } = {}
): CalibrationCase {
  const state = evaluateDigitalTwin({
    readings: opts.readings ?? [reading(1)],
    environment: opts.environment ?? "STATION",
    radiation: {
      stormScale: opts.stormScale ?? "S0_NOMINAL",
      shielding: opts.shielding ?? "CREW_CABIN_NOMINAL",
    },
    now: NOW,
  });

  return { id, description, state };
}

export function buildCalibrationDataset(): CalibrationCase[] {
  return [
    // 1-5: Nominales en los 5 entornos
    buildCase("C01", "Nominal en STATION", { environment: "STATION" }),
    buildCase("C02", "Nominal en SPACECRAFT", { environment: "SPACECRAFT" }),
    buildCase("C03", "Nominal en LUNAR_BASE", { environment: "LUNAR_BASE" }),
    buildCase("C04", "Nominal en ROVER", { environment: "ROVER" }),
    buildCase("C05", "Nominal en MARS_BASE", { environment: "MARS_BASE" }),

    // 6-14: Indicadores individuales en ámbar
    buildCase("C06", "Bradicardia leve (45 lpm)", { readings: [reading(1, { heartRateBpm: 45 })] }),
    buildCase("C07", "Taquicardia leve (95 lpm)", { readings: [reading(1, { heartRateBpm: 95 })] }),
    buildCase("C08", "Presión arterial limítrofe (135/86)", { readings: [reading(1, { systolicMmHg: 135, diastolicMmHg: 86 })] }),
    buildCase("C09", "Glucosa elevada (160 mg/dL)", { readings: [reading(1, { glucoseMgDl: 160 })] }),
    buildCase("C10", "Hipotermia leve (35.8 °C)", { readings: [reading(1, { temperatureC: 35.8 })] }),
    buildCase("C11", "Febrícula (37.8 °C)", { readings: [reading(1, { temperatureC: 37.8 })] }),
    buildCase("C12", "SpO2 limítrofe en STATION (93%)", { readings: [reading(1, { spo2Pct: 93 })], environment: "STATION" }),
    buildCase("C13", "Sueño insuficiente (6.4 h)", { readings: [reading(1, { sleepHours: 6.4 })] }),
    buildCase("C14", "Ejercicio resistivo bajo (40 min)", { readings: [reading(1, { resistanceExerciseMin: 40 })] }),

    // 15-24: Indicadores individuales en rojo (críticos)
    buildCase("C15", "Taquicardia crítica (118 lpm)", { readings: [reading(1, { heartRateBpm: 118 })] }),
    buildCase("C16", "Bradicardia extrema (36 lpm)", { readings: [reading(1, { heartRateBpm: 36 })] }),
    buildCase("C17", "Hipertensión severa (148/94)", { readings: [reading(1, { systolicMmHg: 148, diastolicMmHg: 94 })] }),
    buildCase("C18", "Hipotensión severa (84/55)", { readings: [reading(1, { systolicMmHg: 84, diastolicMmHg: 55 })] }),
    buildCase("C19", "Hipoglucemia crítica (62 mg/dL)", { readings: [reading(1, { glucoseMgDl: 62 })] }),
    buildCase("C20", "Hiperglucemia crítica (195 mg/dL)", { readings: [reading(1, { glucoseMgDl: 195 })] }),
    buildCase("C21", "Fiebre alta (38.6 °C)", { readings: [reading(1, { temperatureC: 38.6 })] }),
    buildCase("C22", "Hipoxia severa (SpO2 88%)", { readings: [reading(1, { spo2Pct: 88 })] }),
    buildCase("C23", "Privación severa de sueño (4.5 h)", { readings: [reading(1, { sleepHours: 4.5 })] }),
    buildCase("C24", "Ánimo crítico (1/5)", { readings: [reading(1, { mood: 1 })] }),

    // 25-28: Mediciones vencidas y sin lecturas
    buildCase("C25", "Vitales vencidos (15 h)", { readings: [reading(15)] }),
    buildCase("C26", "Sueño y ánimo vencidos (30 h)", { readings: [reading(30)] }),
    buildCase("C27", "Todas las mediciones vencidas (52 h)", { readings: [reading(52)] }),
    buildCase("C28", "Sin lecturas registradas", { readings: [] }),

    // 29-32: Tendencias empeorando / mejorando
    buildCase("C29", "2 zonas ámbar empeorando (corazón + sueño)", {
      readings: [
        reading(48, { heartRateBpm: 70, sleepHours: 8 }),
        reading(24, { heartRateBpm: 75, sleepHours: 7.5 }),
        reading(1, { heartRateBpm: 95, sleepHours: 6.3 }),
      ],
    }),
    buildCase("C30", "SpO2 93% empeorando en ROVER hostil", {
      readings: [reading(24, { spo2Pct: 98 }), reading(1, { spo2Pct: 93 })],
      environment: "ROVER",
    }),
    buildCase("C31", "Recuperación mejorando de ámbar a verde", {
      readings: [
        reading(48, { heartRateBpm: 98, sleepHours: 5.5 }),
        reading(24, { heartRateBpm: 92, sleepHours: 6.2 }),
        reading(1, { heartRateBpm: 72, sleepHours: 7.8 }),
      ],
    }),
    buildCase("C32", "Ánimo 3/5 aislado estable en MARS_BASE", {
      readings: [reading(24, { mood: 3 }), reading(1, { mood: 3 })],
      environment: "MARS_BASE",
    }),

    // 33-36: Escenarios de radiación solar y blindaje
    buildCase("C33", "Tormenta S2 en EVA_SUIT", {
      environment: "ROVER",
      stormScale: "S2_MODERATE",
      shielding: "EVA_SUIT",
    }),
    buildCase("C34", "Tormenta S3 en cabina nominal", {
      environment: "SPACECRAFT",
      stormScale: "S3_STRONG",
      shielding: "CREW_CABIN_NOMINAL",
    }),
    buildCase("C35", "Tormenta S4 en EVA_SUIT (crítico)", {
      environment: "ROVER",
      stormScale: "S4_SEVERE",
      shielding: "EVA_SUIT",
    }),
    buildCase("C36", "Tormenta S4 protegido en STORM_SHELTER", {
      environment: "SPACECRAFT",
      stormScale: "S4_SEVERE",
      shielding: "STORM_SHELTER",
    }),
  ];
}

async function runCalibration() {
  const dataset = buildCalibrationDataset();
  const offline = process.argv.includes("--offline") || process.env.DEMO_OFFLINE === "true";
  const service = new DecisionService({
    demoOffline: offline,
    maxCalls: 50,
  });

  let escalarMatches = 0;
  let accionMatches = 0;
  let zoneMatches = 0;
  const totalZoneChecks = dataset.length * BODY_ZONES.length;
  const discrepancies: string[] = [];

  for (const item of dataset) {
    const rule = decideByRules(item.state);
    const result = await service.decide(item.state);
    const model = result.modelEstimate;

    if (rule.escalar === model.escalar) escalarMatches += 1;
    if (rule.accion === model.accion) accionMatches += 1;

    for (const z of BODY_ZONES) {
      if (rule.score[z].riskLevel === model.score[z].riskLevel) {
        zoneMatches += 1;
      }
    }

    if (result.discrepancy.hasDiscrepancy) {
      discrepancies.push(
        `[${item.id}] ${item.description} (${result.source}, conf=${result.confianza}): ${result.discrepancy.reasons.join(" | ")}`
      );
    }
  }

  console.log("=== Calibración Gemelo Digital vs Gemini Decision 1 ===");
  console.log(`Modo: ${offline ? "OFFLINE (solo reglas)" : process.env.GEMINI_API_KEY ? "LIVE Gemini Decision 1" : "FALLBACK (sin GEMINI_API_KEY)"}`);
  console.log(`Casos evaluados: ${dataset.length}`);
  console.log(`Concordancia escalamiento (noul): ${escalarMatches}/${dataset.length} (${((escalarMatches / dataset.length) * 100).toFixed(1)}%)`);
  console.log(`Concordancia acción (choice): ${accionMatches}/${dataset.length} (${((accionMatches / dataset.length) * 100).toFixed(1)}%)`);
  console.log(`Concordancia riesgo por zona (score): ${zoneMatches}/${totalZoneChecks} (${((zoneMatches / totalZoneChecks) * 100).toFixed(1)}%)`);
  console.log(`Discrepancias totales: ${discrepancies.length}`);

  if (discrepancies.length > 0) {
    console.log("\n--- Detalle de discrepancias ---");
    for (const line of discrepancies) console.log(line);
  }
}

runCalibration().catch((err) => {
  console.error("Error en calibración:", err);
  process.exit(1);
});
