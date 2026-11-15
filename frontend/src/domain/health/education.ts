/**
 * @module domain/health/education
 * Crew-facing educational copy: NASA HRP 5-hazard labels, physiological role
 * summaries for the 5 Digital Twin zones, measurement instructions, spaceflight
 * physiology context, and status-specific operational actions per indicator.
 */

import type { BodyZoneId, HealthStatus, IndicatorId, SpaceHazard } from './types';

/** Educational guide for a physiological indicator, written for crew members. */
export interface IndicatorGuide {
  what: string;
  howToMeasure: string[];
  whyInSpace: string;
  actions: Record<Exclude<HealthStatus, 'unknown'>, string>;
}

export interface BodyZoneInfo {
  label: string;
  function: string;
}

export const HAZARD_LABELS: Record<SpaceHazard, string> = {
  radiation: 'Space Radiation',
  isolation: 'Isolation & Confinement',
  distance: 'Distance from Earth',
  gravity: 'Altered Gravity Fields',
  hostileEnvironment: 'Hostile Closed Environments',
};

export const BODY_ZONES: Record<BodyZoneId, BodyZoneInfo> = {
  heart: {
    label: 'Heart',
    function: 'Pumps blood and regulates pressure to deliver oxygen throughout the body.',
  },
  brain: {
    label: 'Brain & Mood',
    function: 'Regulates behavior, emotional state, and operational decision-making.',
  },
  blood: {
    label: 'Blood & Respiration',
    function:
      'Lungs oxygenate blood while circulation distributes glucose and immune defenses; reflects core temperature.',
  },
  bones: {
    label: 'Bones & Muscles',
    function:
      'Support structural posture; without gravitational loading they lose bone density and muscle mass.',
  },
  sleep: {
    label: 'Sleep',
    function: 'Restores physical and cognitive readiness; governed by circadian rhythm.',
  },
};

const SURGEON = 'Notify the flight surgeon.';

export const INDICATOR_GUIDES: Record<IndicatorId, IndicatorGuide> = {
  heartRate: {
    what: 'Resting heartbeats per minute.',
    howToMeasure: [
      'Rest seated or secured for 5 minutes.',
      'Use the pulse oximeter or count wrist pulse for 30 s and multiply by 2.',
    ],
    whyInSpace:
      'In microgravity fluids shift toward the head and the heart adapts, potentially losing aerobic conditioning.',
    actions: {
      green: 'Continue your scheduled exercise routine.',
      amber: 'Re-measure in 30 minutes after resting and hydrating.',
      red: `Stop physical exertion. ${SURGEON}`,
    },
  },
  systolic: {
    what: 'Peak arterial pressure when the heart contracts.',
    howToMeasure: [
      'Sit or tether quietly for 5 minutes without speaking.',
      'Place cuff at heart level with arm relaxed.',
      'Take 2 readings 1 minute apart.',
    ],
    whyInSpace: 'Cephalad fluid redistribution alters systemic blood pressure.',
    actions: {
      green: 'Maintain hydration and exercise.',
      amber: 'Reduce sodium intake and re-check tomorrow at the same time.',
      red: `Re-check in 5 minutes; if elevated, ${SURGEON.toLowerCase()}`,
    },
  },
  diastolic: {
    what: 'Arterial pressure between heartbeats.',
    howToMeasure: ['Recorded in the same measurement as systolic pressure.'],
    whyInSpace: 'Cephalad fluid redistribution alters systemic blood pressure.',
    actions: {
      green: 'Maintain hydration and exercise.',
      amber: 'Reduce sodium intake and re-check tomorrow at the same time.',
      red: `Re-check in 5 minutes; if elevated, ${SURGEON.toLowerCase()}`,
    },
  },
  glucose: {
    what: 'Blood sugar concentration; your primary metabolic fuel.',
    howToMeasure: [
      'Wash hands thoroughly.',
      'Prick the side of the finger with the glucometer lancet.',
      'Note whether fasting or post-meal.',
    ],
    whyInSpace: 'Constrained diet and altered activity levels affect metabolism and nutrition.',
    actions: {
      green: 'Follow standard meal plan.',
      amber: 'Review your last meal and re-test in 2 hours.',
      red: `If low (<70), take 15 g fast-acting carbohydrates. ${SURGEON}`,
    },
  },
  temperature: {
    what: 'Core body temperature.',
    howToMeasure: [
      'Hold thermometer under the tongue for 1 minute.',
      'Avoid measuring immediately after eating, drinking, or exercising.',
    ],
    whyInSpace:
      'Radiation and closed habitats weaken immune response; fever can indicate infection.',
    actions: {
      green: 'No action needed.',
      amber: 'Hydrate, rest, and re-measure in 1 hour.',
      red: `Isolate if feasible and open the medical kit. ${SURGEON}`,
    },
  },
  spo2: {
    what: 'Percentage of oxygen carried by your blood.',
    howToMeasure: [
      'Place a clean, warm finger in the pulse oximeter.',
      'Hold still for 30 s until the reading stabilizes.',
    ],
    whyInSpace:
      'Life-support anomalies or cabin CO₂ buildup reduce blood oxygenation.',
    actions: {
      green: 'No action needed.',
      amber: 'Take deep breaths, verify module ventilation, and re-measure.',
      red: `Use supplemental oxygen and check ECLSS life support. ${SURGEON}`,
    },
  },
  sleepHours: {
    what: 'Total hours slept in the past 24 hours.',
    howToMeasure: [
      'Log sleep onset and wake times.',
      'Subtract prolonged awakenings.',
    ],
    whyInSpace:
      'Without a natural day/night cycle (16 orbital sunrises daily), circadian rhythm drifts.',
    actions: {
      green: 'Keep your consistent sleep schedule.',
      amber: 'Reduce screens and blue light before sleep.',
      red: `Request a task schedule adjustment. ${SURGEON}`,
    },
  },
  mood: {
    what: 'How you feel today, from 1 (very poor) to 5 (excellent).',
    howToMeasure: ['Select the number that honestly reflects your day.'],
    whyInSpace:
      'Isolation, confinement, and distance from Earth directly impact behavioral health.',
    actions: {
      green: 'Stay connected with the crew.',
      amber: 'Schedule a family call or leisure activity.',
      red: `Speak with a trusted crewmate. ${SURGEON}`,
    },
  },
  resistanceExercise: {
    what: 'Daily minutes of resistive loading exercise (squats, deadlifts, presses).',
    howToMeasure: [
      'Log active time on the resistive exercise device (ISS ARED equivalent).',
      'Exclude warm-up and long rest breaks.',
    ],
    whyInSpace:
      'Without gravity, weight-bearing bones lose ~1–1.5% density per month; mechanical loading slows loss.',
    actions: {
      green: 'Maintain your training plan.',
      amber: 'Complete your pending session today; prioritize legs and hips.',
      red: `Reschedule tasks to train today. If missed for several days, ${SURGEON.toLowerCase()}`,
    },
  },
};
