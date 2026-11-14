'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Radiation,
  UsersRound,
  Compass,
  Scale,
  Biohazard,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface Hazard {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  icon: typeof Radiation;
  summary: string;
  indicator: string;
  unit: string;
  normalRange: string;
  criticalThreshold: string;
  physiologicalRisk: string;
  countermeasure: string;
}

const HAZARDS: Hazard[] = [
  {
    id: 'radiation',
    code: 'R',
    title: 'Space Radiation',
    subtitle: 'Galactic Cosmic Rays',
    icon: Radiation,
    summary:
      'Galactic cosmic rays (GCR) and high-energy solar particle events outside Earth’s protective magnetosphere.',
    indicator: 'Body Temperature & Heart Rate',
    unit: '°C / bpm',
    normalRange: '36.1 – 37.5 °C',
    criticalThreshold: '> 38.0 °C (Fever / systemic inflammation) or HR > 100 bpm',
    physiologicalRisk:
      'Endothelial cellular damage, oxidative stress, immunosuppression, and acute cardiovascular strain.',
    countermeasure:
      'Hydrogen-rich polyethylene shielding inside the lunar habitat paired with active real-time dosimetry.',
  },
  {
    id: 'isolation',
    code: 'I',
    title: 'Isolation & Confinement',
    subtitle: 'Behavioral Health',
    icon: UsersRound,
    summary:
      'Small crews living in confined volumes for months without natural daylight cycles or real-time Earth contact.',
    indicator: 'Sleep Duration & Mood',
    unit: 'h/day & 1–5 Scale',
    normalRange: '≥ 7 h sleep · Mood 4–5',
    criticalThreshold: '< 6 h sleep or Mood ≤ 2/5 (Fatigue / Burnout)',
    physiologicalRisk:
      'Circadian rhythm desynchronization, degraded operational cognition, and interpersonal crew friction.',
    countermeasure:
      'Blue-enriched spectral lighting protocols and a daily countermeasure streak checklist.',
  },
  {
    id: 'distance',
    code: 'D',
    title: 'Distance from Earth',
    subtitle: 'Autonomous Care',
    icon: Compass,
    summary:
      'Over 384,400 km from Earth at the lunar south pole. Immediate medical evacuation is not feasible.',
    indicator: 'Blood Glucose & Nutrition',
    unit: 'mg/dL',
    normalRange: '70 – 140 mg/dL',
    criticalThreshold: '< 70 mg/dL (Hypoglycemia) or > 180 mg/dL',
    physiologicalRisk:
      'Metabolic instability, delayed ground support, and strict reliance on onboard diagnostic autonomy.',
    countermeasure:
      'Orbvital autonomous clinical decision trees paired with store-and-forward flight surgeon telemedicine.',
  },
  {
    id: 'gravity',
    code: 'G',
    title: 'Altered Gravity (0.166g)',
    subtitle: 'Vestibular & Fluid Shift',
    icon: Scale,
    summary:
      'Transition between orbital microgravity (0g) and lunar gravity (1/6 g), triggering vestibular and fluid shifts.',
    indicator: 'Blood Pressure & Heart Rate',
    unit: 'mmHg & bpm',
    normalRange: '< 130 / < 85 mmHg',
    criticalThreshold: '≥ 140/90 mmHg (Hypertension) or Systolic < 90 mmHg',
    physiologicalRisk:
      'Cephalad fluid redistribution (SANS neuro-ocular syndrome) and accelerated bone mineral loss.',
    countermeasure:
      'Two hours daily of cycle ergometer resistance training and lower-extremity compression garments.',
  },
  {
    id: 'hostile-environment',
    code: 'H',
    title: 'Hostile Closed Environments',
    subtitle: 'Habitat Atmosphere',
    icon: Biohazard,
    summary:
      'Sealed lunar habitat atmosphere exposed to abrasive lunar regolith dust and CO₂ fluctuations.',
    indicator: 'Oxygen Saturation (SpO₂)',
    unit: '%',
    normalRange: '≥ 95 % SpO₂',
    criticalThreshold: '< 92 % SpO₂ (Hypoxemia / Hypercapnia)',
    physiologicalRisk:
      'Pulmonary atelectasis, respirable lunar dust toxicity, and tissue hypoxia from cabin pressure drops.',
    countermeasure:
      'Suitport dust decontamination airlocks, activated-carbon HEPA filtration, and emergency O₂ cannulas.',
  },
];

export function HazardsSection() {
  const [selectedHazard, setSelectedHazard] = useState<Hazard>(HAZARDS[0]);

  return (
    <section className="my-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            The 5 Hazards of Spaceflight
          </h2>
          <p className="mt-2 text-sm sm:text-base text-stem max-w-2xl">
            Physiological risks defined by NASA’s Human Research Program and their direct mapping
            to onboard vital signs.
          </p>
        </div>

        <Link
          href="/readings/new"
          className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line-strong bg-canvas/80 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-blueberry hover:bg-plate hover:text-ink-inverse self-start md:self-auto"
        >
          <span>Evaluate metrics</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Asymmetric 4/8 industrial datasheet — single flat container, spaced sections, zero inner borders */}
      <div className="surface-card grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 p-6 sm:p-8">
        {/* Left narrow index rail */}
        <div
          role="tablist"
          aria-label="Physiological hazards of human spaceflight"
          className="lg:col-span-4 space-y-1"
        >
          {HAZARDS.map((h) => {
            const Icon = h.icon;
            const isSelected = selectedHazard.id === h.id;
            return (
              <button
                key={h.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedHazard(h)}
                className={`tactile-press w-full flex items-start justify-between gap-3 px-3 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-l-2 border-plate text-blueberry'
                    : 'border-l-2 border-transparent text-stem hover:text-blueberry'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`font-mono text-xs font-bold pt-0.5 tabular-nums ${
                      isSelected ? 'text-blueberry' : 'text-berry'
                    }`}
                  >
                    [{h.code}]
                  </span>
                  <div>
                    <span className="text-sm font-bold block leading-snug">{h.title}</span>
                    <span className="font-mono text-[11px] block mt-0.5 text-stem">
                      {h.subtitle}
                    </span>
                  </div>
                </div>
                <Icon
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    isSelected ? 'text-blueberry' : 'text-stem'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right wide technical dossier — grouped with 32px+ spacing, no internal dividers */}
        <div
          key={selectedHazard.id}
          className="lg:col-span-8 space-y-8 animate-materialize"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-center gap-3">
              <selectedHazard.icon className="h-5 w-5 text-berry" />
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-blueberry">
                {selectedHazard.title}
              </h3>
            </div>
            <span className="font-mono text-xs text-stem uppercase tracking-wider">
              HAZARD_REF // [{selectedHazard.code}]
            </span>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-yogurt max-w-2xl">
            {selectedHazard.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-status-caution">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Physiological impact</span>
              </div>
              <p className="text-xs text-blueberry/90 leading-relaxed">
                {selectedHazard.physiologicalRisk}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-status-nominal">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Countermeasure</span>
              </div>
              <p className="text-xs text-blueberry/90 leading-relaxed">
                {selectedHazard.countermeasure}
              </p>
            </div>
          </div>

          {/* Borderless aligned reference parameters — hierarchy via spacing & semantic color */}
          <div className="space-y-4 pt-2">
            <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wider text-stem">
              <span>REFERENCE_PARAMETERS</span>
              <span className="tabular-nums">UNIT: {selectedHazard.unit}</span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 font-mono text-xs">
              <div>
                <dt className="text-[11px] text-stem uppercase">Indicator</dt>
                <dd className="mt-1.5 font-sans text-sm font-bold text-blueberry">
                  {selectedHazard.indicator}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-stem uppercase">Nominal</dt>
                <dd className="mt-1.5 font-bold text-status-nominal tabular-nums">
                  {selectedHazard.normalRange}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-stem uppercase">Critical</dt>
                <dd className="mt-1.5 font-bold text-status-critical tabular-nums leading-relaxed">
                  {selectedHazard.criticalThreshold}
                </dd>
              </div>
            </dl>

            <div className="flex justify-end pt-2">
              <Link
                href="/readings/new"
                className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-plate hover:bg-berry"
              >
                <HeartPulse className="h-4 w-4" />
                <span>Log Reading</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
