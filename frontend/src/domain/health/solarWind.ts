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

export type SolarAlertBand = 'S0_S1' | 'S2_S3' | 'S4_S5';

export type SolarProtocolBlockId =
  | 'PHYSICAL_OPS'
  | 'BIOMEDICAL_DOSIMETRY'
  | 'CLINICAL_WELLBEING'
  | 'COMMS_COMMAND';

export interface SolarProtocolBlock {
  id: SolarProtocolBlockId;
  title: string;
  actions: string[];
}

export interface SolarDirectiveTemplate {
  band: SolarAlertBand;
  shortLabel: string;
  title: string;
  defaultWindowHours: number;
  allClearCriteria: string;
  body: string;
}

export interface SolarUniversalProtocol {
  band: SolarAlertBand;
  label: string;
  autonomousRule: string;
  blocks: SolarProtocolBlock[];
  directiveTemplate: SolarDirectiveTemplate;
}

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
    case 'systolic':
    case 'diastolic':
      return 'Autonomic stress during solar particle alerts can transiently elevate blood pressure.';
    case 'temperature':
      return 'Helps distinguish infectious fever from radiation-shelter thermal or metabolic stress.';
    case 'spo2':
      return 'Monitors cabin/shelter CO₂ scrubbing and oxygenation stability when crew concentrates in sheltered modules.';
    case 'glucose':
      return 'Stress-hormone shifts during high-alert windows can mildly elevate fasting glucose.';
    case 'resistanceExercise':
      return 'EVA cancellations or storm-shelter confinement can reduce daily resistance countermeasure load.';
  }
}

/**
 * Maps a NOAA S-scale (and early-warning flag) to the 3 universal operational
 * space-medicine bands: S0-S1 (Watch), S2-S3 (Elevated / EVA Hold), S4-S5 (Critical / Shelter).
 */
export function getSolarAlertBand(
  stormScale: NOAAStormScale,
  earlyWarningActive = false,
): SolarAlertBand {
  if (stormScale === 'S4_SEVERE' || stormScale === 'S5_EXTREME') return 'S4_S5';
  if (stormScale === 'S2_MODERATE' || stormScale === 'S3_STRONG' || earlyWarningActive) {
    return 'S2_S3';
  }
  return 'S0_S1';
}

/**
 * Returns the 4 standard space-medicine protocol blocks and 1-click Flight Surgeon
 * directive template for any crewed mission (LEO, cislunar transit, lunar orbit/surface).
 */
export function getUniversalSolarProtocol(band: SolarAlertBand): SolarUniversalProtocol {
  switch (band) {
    case 'S4_S5':
      return {
        band: 'S4_S5',
        label: 'S4–S5 Critical · Mandatory Shelter',
        autonomousRule:
          'AUTONOMOUS S4–S5: Immediate EVA abort & mandatory STORM_SHELTER ingress if Earth link is delayed or lost.',
        blocks: [
          {
            id: 'PHYSICAL_OPS',
            title: '1. Physical Protection & Operations (Immediate)',
            actions: [
              'Abort all EVAs immediately; do not remain in EVA_SUIT during proton arrival.',
              'Move entire crew into highest-shielding STORM_SHELTER (central water/equipment-lined core or shielded habitat).',
              'Execute passive vehicle reorientation (point propulsion/tanks/cargo mass toward the Sun) and power down external optical sensors.',
            ],
          },
          {
            id: 'BIOMEDICAL_DOSIMETRY',
            title: '2. Biomedical Monitoring & Dosimetry',
            actions: [
              'Increase biometric & vital logging cadence to every 4–6 h (HR, BP, temperature, SpO2, sleep, mood).',
              'Log acute symptom onset (fatigue, nausea, headache) and correlate against personal active dosimeter mSv rate.',
            ],
          },
          {
            id: 'CLINICAL_WELLBEING',
            title: '3. Clinical Countermeasures & Wellbeing',
            actions: [
              'Enforce >= 2.5 L/24h electrolyte hydration and Flight Surgeon radioprotective/antiemetic regimen.',
              'Suspend non-critical strenuous exercise and high-cognitive-load tasks during peak flux.',
              'Protect crew sleep blocks and perform brief behavioral mood check-ins inside shelter.',
            ],
          },
          {
            id: 'COMMS_COMMAND',
            title: '4. Communication & Command (Flight Surgeon ↔ Crew)',
            actions: [
              'Flight Surgeon issues shelter start/end window directive with explicit All-Clear exit criteria.',
              'Autonomous Mode: Under 20–40 min latency or blackout, remain in STORM_SHELTER until >10 MeV flux drops below 100 pfu for 2 consecutive hours.',
            ],
          },
        ],
        directiveTemplate: {
          band: 'S4_S5',
          shortLabel: 'S4–S5 Mandatory Shelter',
          title: '[S4–S5 CRITICAL] Mandatory Storm Shelter & Radioprotection',
          defaultWindowHours: 12,
          allClearCriteria: 'GOES >10 MeV proton flux < 100 pfu for 2h AND dosimeter rate < 50 uSv/h.',
          body: 'Abort all EVAs immediately. Ingress STORM_SHELTER with water/equipment shielding, orient high-mass section sunward, enforce 4–6h vital checks, hydrate >= 2.5 L/24h with radioprotective pack, and suspend strenuous exercise.',
        },
      };

    case 'S2_S3':
      return {
        band: 'S2_S3',
        label: 'S2–S3 Elevated · EVA Hold & Shelter Prep',
        autonomousRule:
          'AUTONOMOUS S2–S3: Cancel/postpone EVAs, restrict crew to nominal cabin, and stage STORM_SHELTER.',
        blocks: [
          {
            id: 'PHYSICAL_OPS',
            title: '1. Physical Protection & Operations (Immediate)',
            actions: [
              'Postpone or cancel planned EVAs; avoid EVA_SUIT exposure during the solar arrival window.',
              'Restrict crew to shielded cabin interior (no unshielded cupolas) and stage STORM_SHELTER supplies.',
              'Prepare passive mass-toward-Sun attitude hold if proton flux escalates toward S4.',
            ],
          },
          {
            id: 'BIOMEDICAL_DOSIMETRY',
            title: '2. Biomedical Monitoring & Dosimetry',
            actions: [
              'Step up biometric checks from daily to every 4–6 h (HR, BP, temperature, sleep, mood).',
              'Correlate fatigue or HRV shifts with solar wind speed and active dosimeter readings.',
            ],
          },
          {
            id: 'CLINICAL_WELLBEING',
            title: '3. Clinical Countermeasures & Wellbeing',
            actions: [
              'Reinforce oral hydration and daily antioxidant/radioprotector supplement protocol.',
              'Reduce high-intensity physical exertion and defer non-essential high-cognitive tasks.',
              'Prioritize uninterrupted sleep blocks and run a brief behavioral check-in.',
            ],
          },
          {
            id: 'COMMS_COMMAND',
            title: '4. Communication & Command (Flight Surgeon ↔ Crew)',
            actions: [
              'Flight Surgeon issues preventive EVA-hold directive with shelter readiness window.',
              'Autonomous Mode: Under link delay/blackout, keep EVAs on hold and escalate to STORM_SHELTER if flux exceeds 1,000–10,000 pfu.',
            ],
          },
        ],
        directiveTemplate: {
          band: 'S2_S3',
          shortLabel: 'S2–S3 EVA Hold & Prep',
          title: '[S2–S3 ELEVATED] EVA Hold, 4–6h Vitals & Shelter Staging',
          defaultWindowHours: 6,
          allClearCriteria: 'GOES >10 MeV proton flux < 50 pfu AND no X-class flare rise for 3h.',
          body: 'Postpone all EVAs and restrict crew to nominal shielded cabin. Stage STORM_SHELTER, log 7 vitals every 4–6h, reinforce hydration + antioxidant protocol, and defer strenuous exercise until All-Clear.',
        },
      };

    case 'S0_S1':
    default:
      return {
        band: 'S0_S1',
        label: 'S0–S1 Nominal / Minor Watch',
        autonomousRule:
          'AUTONOMOUS S0–S1: Maintain nominal watch, standard daily vitals, and verify shelter readiness.',
        blocks: [
          {
            id: 'PHYSICAL_OPS',
            title: '1. Physical Protection & Operations',
            actions: [
              'Nominal operations; EVAs permitted with standard real-time space-weather watch.',
              'Verify STORM_SHELTER hatch clearance and potable water bag stowage readiness.',
            ],
          },
          {
            id: 'BIOMEDICAL_DOSIMETRY',
            title: '2. Biomedical Monitoring & Dosimetry',
            actions: [
              'Maintain daily 7-vital check-in and verify cumulative CPD active dosimeter log.',
              'Use Trends to separate microgravity/exercise baseline shifts from space-weather spikes.',
            ],
          },
          {
            id: 'CLINICAL_WELLBEING',
            title: '3. Clinical Countermeasures & Wellbeing',
            actions: [
              'Execute standard 2.5 L hydration, Vitamin D3/nutrition, and ARED/T2 exercise routine.',
              'Protect circadian lighting schedule and log daily sleep hours and mood.',
            ],
          },
          {
            id: 'COMMS_COMMAND',
            title: '4. Communication & Command (Flight Surgeon ↔ Crew)',
            actions: [
              'Standard Flight Surgeon sync; no preventive shelter window active.',
              'Autonomous Mode: If Earth link drops during S1 minor flare watch, hold non-urgent EVAs until telemetry resumes.',
            ],
          },
        ],
        directiveTemplate: {
          band: 'S0_S1',
          shortLabel: 'S0–S1 Watch & Baseline',
          title: '[S0–S1 WATCH] Nominal Space-Weather Surveillance',
          defaultWindowHours: 24,
          allClearCriteria: 'Continuous S0 nominal (< 10 pfu) and stable IMF Bz.',
          body: 'Maintain standard daily biomedical check-ins, 2.5 L hydration, and ARED/T2 countermeasures. Confirm STORM_SHELTER readiness and monitor NOAA SWPC/GOES telemetry.',
        },
      };
  }
}

/**
 * General solar-storm / solar-wind mitigation measures applicable to any crewed mission,
 * cleanly separated across the 3 operational roles and 3 severity bands (S0-S1 / S2-S3 / S4-S5).
 */
export function getRoleBasedSolarMeasures(
  stormScale: NOAAStormScale,
  earlyWarningActive: boolean,
): Record<OperationalRole, RoleMeasureGroup> {
  const band = getSolarAlertBand(stormScale, earlyWarningActive);

  return {
    OPERATOR: {
      role: 'OPERATOR',
      roleTitle: 'Ground Operator (Mission Control)',
      subtitle: 'Vehicle/habitat operations, EVA hold, and early-warning coordination (non-clinical).',
      actions:
        band === 'S4_S5'
          ? [
              'Abort all EVAs immediately; prohibit EVA_SUIT exposure during proton arrival.',
              'Command immediate crew ingress to STORM_SHELTER (water/equipment-shielded core).',
              'Execute passive sunward mass reorientation and power down external optical sensors.',
              'Escalate radiation incident to Flight Surgeon and track shelter ingress confirmation.',
            ]
          : band === 'S2_S3'
            ? [
                'Cancel or postpone scheduled EVAs during the predicted solar arrival window.',
                'Restrict crew to shielded cabin interior and verify STORM_SHELTER sealing/supplies.',
                'Monitor SWPC/GOES flux and notify Flight Surgeon of estimated arrival window.',
              ]
            : [
                'Maintain nominal DSCOVR/GOES solar-wind surveillance and EVA flight-rule watch.',
                'Verify STORM_SHELTER readiness and crew telemetry link health.',
              ],
    },
    ADMIN: {
      role: 'ADMIN',
      roleTitle: 'Flight Surgeon (Medical Lead)',
      subtitle: 'Crew health authority: triage, 4–6h dosimetry cadence, and preventive directives.',
      actions:
        band === 'S4_S5'
          ? [
              'Escalate vital & dosimetry logging to every 4–6 h inside STORM_SHELTER.',
              'Issue 1-click S4–S5 Directive: >= 2.5 L hydration, radioprotector/antiemetic protocol, and shelter window.',
              'Suspend strenuous exercise and high-cognitive-load tasks; protect sleep blocks.',
              'Track acute symptoms vs dosimeter rate and authorize All-Clear only when < 100 pfu for 2h.',
            ]
          : band === 'S2_S3'
            ? [
                'Increase biomedical check-in cadence to every 4–6 h prior to and during arrival window.',
                'Issue preventive S2–S3 Directive: hydration, antioxidant pack, and physical load reduction.',
                'Correlate fatigue, HRV, or mood changes with solar-wind telemetry in Trends.',
              ]
            : [
                'Maintain standard daily 7-vital cadence and longitudinal trend review.',
                'Separate operational/microgravity baseline shifts from solar-weather effects.',
              ],
    },
    USER: {
      role: 'USER',
      roleTitle: 'Astronaut (Onboard Crew)',
      subtitle: 'Onboard shelter execution, countermeasure adherence, and self-reporting.',
      actions:
        band === 'S4_S5'
          ? [
              'Abort EVA and move immediately to STORM_SHELTER with water/equipment shielding.',
              'Complete >= 2.5 L electrolyte hydration and radioprotector regimen; avoid intense exercise.',
              'Log all 7 vitals and behavioral mood check-in every 4–6 h (or follow Autonomous Mode if link drops).',
            ]
          : band === 'S2_S3'
            ? [
                'Hold planned EVAs, stage gear in shielded cabin, and confirm STORM_SHELTER readiness.',
                'Reinforce hydration, reduce strenuous load, and log 4–6 h control readings.',
              ]
            : [
                'Follow nominal daily countermeasure routine and log scheduled 7-vital reading.',
                'Report any unusual fatigue, headache, or sleep disruption in Log Reading.',
              ],
    },
  };
}
