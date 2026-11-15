import type { NOAAStormScale, RadiationStatusResponse } from '@/services/radiationService';
import type { TrendPoint } from './trends';
import type { IndicatorId } from './types';

export interface SolarWindPoint {
  t: number;
  speedKmS: number;
  protonFluxPfu: number;
  bzNt: number;
  kpIndex: number;
  stormScale: NOAAStormScale;
}

export interface SolarWindCorrelation {
  pearsonR: number;
  strengthLabel: string;
  directionLabel: string;
  stormAvg: number | null;
  nominalAvg: number | null;
  deltaPct: number | null;
  stormCount: number;
  nominalCount: number;
}

export type OperationalRole = 'OPERATOR' | 'ADMIN' | 'USER';

export interface RoleMeasureGroup {
  role: OperationalRole;
  roleTitle: string;
  subtitle: string;
  actions: string[];
}

export const ELEVATED_WIND_THRESHOLD_KMS = 520;

function scaleFromFlux(pfu: number): NOAAStormScale {
  if (pfu >= 100_000) return 'S5_EXTREME';
  if (pfu >= 10_000) return 'S4_SEVERE';
  if (pfu >= 1_000) return 'S3_STRONG';
  if (pfu >= 100) return 'S2_MODERATE';
  if (pfu >= 10) return 'S1_MINOR';
  return 'S0_NOMINAL';
}

/**
 * Generates a deterministic, physically plausible solar wind series aligned to the
 * timestamps of the astronaut's trend points and anchored to live/fallback NOAA telemetry.
 */
export function buildSolarWindSeries(
  points: TrendPoint[],
  status?: RadiationStatusResponse | null,
): SolarWindPoint[] {
  if (!points.length) return [];

  const liveScale = status?.currentTelemetry.stormScale ?? 'S0_NOMINAL';
  const liveProton =
    status?.currentTelemetry.latestProtons?.find((p) => p.energyChannel.includes('10'))?.fluxPfu ??
    0.8;
  const baseSpeed = liveScale === 'S0_NOMINAL' ? 410 : liveScale === 'S1_MINOR' ? 530 : 660;

  return points.map((p, idx) => {
    const progress = points.length > 1 ? idx / (points.length - 1) : 1;
    // Smooth synoptic wave + solar-stream pulse near the final third of the window
    const wave = Math.sin(progress * Math.PI * 3.1) * 55 + Math.cos(progress * Math.PI * 5.7) * 28;
    const stormPulse = Math.exp(-(((progress - 0.72) / 0.14) ** 2)) * 185;
    const isLast = idx === points.length - 1;
    const speedKmS = Math.round(
      Math.max(310, Math.min(890, (isLast ? baseSpeed : 405) + wave + stormPulse)),
    );
    const bzNt = +(-1.8 - (speedKmS - 380) / 55 + Math.sin(idx * 1.3) * 1.4).toFixed(1);
    const kpIndex = +Math.min(9, Math.max(1, 1.5 + (speedKmS - 350) / 85)).toFixed(1);
    const protonFluxPfu = isLast
      ? liveProton
      : +(speedKmS >= 560 ? 12 + (speedKmS - 560) * 0.45 : 0.4 + Math.max(0, (speedKmS - 380) * 0.01)).toFixed(1);

    return {
      t: p.t,
      speedKmS,
      protonFluxPfu,
      bzNt,
      kpIndex,
      stormScale: scaleFromFlux(protonFluxPfu),
    };
  });
}

/**
 * Computes Pearson correlation (r) and storm-window vs nominal-window vital averages.
 */
export function correlateSolarWindWithVitals(
  points: TrendPoint[],
  solarSeries: SolarWindPoint[],
): SolarWindCorrelation {
  const n = Math.min(points.length, solarSeries.length);
  if (n < 2) {
    return {
      pearsonR: 0,
      strengthLabel: 'Insufficient data',
      directionLabel: 'Neutral',
      stormAvg: null,
      nominalAvg: null,
      deltaPct: null,
      stormCount: 0,
      nominalCount: n,
    };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  const stormVals: number[] = [];
  const nominalVals: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = solarSeries[i].speedKmS;
    const y = points[i].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;

    if (x >= ELEVATED_WIND_THRESHOLD_KMS || solarSeries[i].kpIndex >= 5) {
      stormVals.push(y);
    } else {
      nominalVals.push(y);
    }
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const pearsonR = den > 1e-9 ? Math.max(-1, Math.min(1, num / den)) : 0;

  const absR = Math.abs(pearsonR);
  const strengthLabel =
    absR >= 0.6 ? 'Strong' : absR >= 0.35 ? 'Moderate' : absR >= 0.15 ? 'Mild' : 'Weak';
  const directionLabel =
    absR < 0.15 ? 'Neutral' : pearsonR > 0 ? 'Positive' : 'Inverse';

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((acc, v) => acc + v, 0) / arr.length : null;
  const stormAvg = avg(stormVals);
  const nominalAvg = avg(nominalVals);
  const deltaPct =
    stormAvg !== null && nominalAvg !== null && Math.abs(nominalAvg) > 1e-6
      ? ((stormAvg - nominalAvg) / nominalAvg) * 100
      : null;

  return {
    pearsonR,
    strengthLabel,
    directionLabel,
    stormAvg,
    nominalAvg,
    deltaPct,
    stormCount: stormVals.length,
    nominalCount: nominalVals.length,
  };
}

export function indicatorSolarNote(indicator: IndicatorId): string {
  switch (indicator) {
    case 'heartRate':
      return 'Elevated solar wind / storm windows often coincide with sympathetic arousal or EVA workload spikes.';
    case 'sleepHours':
      return 'High Kp / storm alerts and shelter transitions can fragment circadian sleep architecture.';
    case 'mood':
      return 'Confinement in storm shelters and operational alerts commonly correlate with dips in crew mood.';
    case 'systolicBp':
    case 'diastolicBp':
      return 'Autonomic stress during solar particle alerts can transiently elevate blood pressure.';
    case 'temperature':
      return 'Helps distinguish infectious fever from radiation-shelter thermal or metabolic stress.';
    case 'spo2':
      return 'Monitors cabin/shelter CO₂ scrubbing and oxygenation stability when crew concentrates in sheltered modules.';
    case 'glucose':
      return 'Stress-hormone shifts during high-alert windows can mildly elevate fasting glucose.';
  }
}

/**
 * General solar-storm / solar-wind mitigation measures applicable to any crewed mission,
 * cleanly separated across the 3 operational roles:
 * - OPERATOR: Ground control (vehicle/habitat operations, no clinical values)
 * - ADMIN: Flight Surgeon (astronaut health lead, directives & clinical cadence)
 * - USER: Astronaut (onboard execution & self-reporting)
 */
export function getRoleBasedSolarMeasures(
  stormScale: NOAAStormScale,
  earlyWarningActive: boolean,
): Record<OperationalRole, RoleMeasureGroup> {
  const elevated = stormScale !== 'S0_NOMINAL' || earlyWarningActive;
  const severe = stormScale === 'S2_MODERATE' || stormScale === 'S3_STRONG' || stormScale === 'S4_SEVERE' || stormScale === 'S5_EXTREME';

  return {
    OPERATOR: {
      role: 'OPERATOR',
      roleTitle: 'Operador en Tierra (Ground Control)',
      subtitle: 'Coordinación operativa de nave, EVA y alerta temprana (sin datos clínicos).',
      actions: severe
        ? [
            'Abortar o posponer inmediatamente toda EVA y actividad externa.',
            'Ordenar transición de cabina/hábitat a modo STORM_SHELTER.',
            'Ejecutar reorientación pasiva (masa/tanques hacia el Sol) y proteger sensores externos.',
            'Escalar incidente de radiación al Cirujano de Vuelo y confirmar enlace.',
          ]
        : elevated
          ? [
              'Poner en pausa preventiva las EVAs programadas durante la ventana solar.',
              'Verificar disponibilidad y sellado de zona STORM_SHELTER.',
              'Monitorear flujo SWPC/GOES y notificar ventana estimada al Cirujano de Vuelo.',
            ]
          : [
              'Mantener vigilancia nominal de viento solar (DSCOVR/GOES) y ventanas de EVA.',
              'Verificar estado de refugio y canales de telemetría con la tripulación.',
            ],
    },
    ADMIN: {
      role: 'ADMIN',
      roleTitle: 'Cirujano de Vuelo (Flight Surgeon)',
      subtitle: 'Astronauta encargado de la salud: triage, dosimetría y directivas preventivas.',
      actions: severe
        ? [
            'Aumentar frecuencia de controles biométricos y dosimetría a cada 4–6 h.',
            'Emitir Directiva preventiva: hidratación reforzada y protocolo radioprotector.',
            'Reducir carga física intensa y proteger bloques de descanso durante el pico.',
            'Evaluar signos de estrés agudo/cardiovascular y autorizar All-clear al bajar a S0–S1.',
          ]
        : elevated
          ? [
              'Solicitar lectura biométrica adicional previa a la ventana de llegada solar.',
              'Reforzar hidratación y revisar tendencia de sueño/FC frente a alertas.',
              'Preparar directiva de resguardo por si la tormenta escala a S2+.',
            ]
          : [
              'Mantener cadencia estándar de controles diarios y revisión de tendencias.',
              'Separar alteraciones operativas de posibles efectos de radiación en Trends.',
            ],
    },
    USER: {
      role: 'USER',
      roleTitle: 'Astronauta (Tripulación)',
      subtitle: 'Ejecución de protocolo de resguardo a bordo y reporte biométrico.',
      actions: severe
        ? [
            'Suspender salida EVA y trasladarse al área de mayor blindaje (STORM_SHELTER).',
            'Completar hidratación adicional y evitar ejercicio de alta intensidad en el pico.',
            'Registrar signos vitales y check-in de ánimo en Log Reading cada 4–6 h.',
          ]
        : elevated
          ? [
              'Preparar equipo en zona protegida y confirmar estado antes de ventana solar.',
              'Priorizar hidratación, descanso y registrar lectura biométrica de control.',
            ]
          : [
              'Seguir rutina nominal de misión y registrar lectura biométrica programada.',
              'Reportar cualquier fatiga, cefalea o alteración de sueño en Log Reading.',
            ],
    },
  };
}
