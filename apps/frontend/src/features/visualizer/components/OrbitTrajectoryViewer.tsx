'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Orbit,
  Rocket,
  Globe,
  ExternalLink,
  Wind,
  AlertTriangle,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import type { ScenarioId } from '../services/biophysicsService';
import { SolarDiskPicker } from './SolarDiskPicker';

interface TargetPrediction {
  target: string;
  label: string;
  status: 'DIRECT_HIT' | 'GLANCING_BLOW' | 'MAGNETOSPHERE_SHIELDED' | 'MISS';
  impactProbabilityPct: number;
  estimatedArrivalMinutes: number | null;
  cmeArrivalHours: number | null;
  notes: string;
}

interface SolarWindPredictionState {
  activeScenario?: string;
  currentTelemetry?: { stormScale: string };
  solarWind: {
    speedKmS: number;
    densityPcm3: number;
    bzNt: number;
    dynamicPressureNpa: number;
    parkerFootpointLonDeg: number;
  };
  earlyWarning: {
    isWarningActive: boolean;
    estimatedProtonArrivalMinutes: number | null;
    predictedStormScale: string;
  };
  impactPrediction: {
    sourceLocation: string;
    sourceLatDeg: number;
    sourceLonDeg: number;
    coneHalfAngleDeg: number;
    magnetopauseStandoffRe: number;
    primaryImpactZone: 'CISLUNAR_AND_EARTH_DIRECT' | 'FLANK_GLANCING_BLOW' | 'DEEP_SPACE_MISS';
    geomagneticGScale: string;
    targets: TargetPrediction[];
    summary: string;
  };
}

const STONYHURST_REGEX = /^[NS]\d{1,2}[EW]\d{1,3}$/i;

const SOURCE_PRESETS: { label: string; source: string; flareClass: 'C' | 'M' | 'X'; halfAngle: number }[] = [
  { label: 'N14W42 · Direct Hit (X)', source: 'N14W42', flareClass: 'X', halfAngle: 52 },
  { label: 'S08W32 · Severe S4 (X)', source: 'S08W32', flareClass: 'X', halfAngle: 60 },
  { label: 'S18E72 · East-Limb Miss', source: 'S18E72', flareClass: 'X', halfAngle: 34 },
  { label: 'N05W12 · Nominal (C)', source: 'N05W12', flareClass: 'C', halfAngle: 25 },
];

const SCENARIO_DEFAULTS: Record<ScenarioId, { source: string; flareClass: 'C' | 'M' | 'X'; halfAngle: number }> = {
  NOMINAL: { source: 'N05W12', flareClass: 'C', halfAngle: 25 },
  FLARE_EARLY_WARNING: { source: 'N14W42', flareClass: 'X', halfAngle: 52 },
  PEAK_STORM_S4: { source: 'S08W32', flareClass: 'X', halfAngle: 60 },
};

function buildLocalFallbackPrediction(
  sourceLocation: string,
  flareClass: 'C' | 'M' | 'X',
  halfAngleDeg: number,
  scenarioTag?: string
): SolarWindPredictionState {
  const match = sourceLocation.trim().toUpperCase().match(/^([NS])(\d{1,2})([EW])(\d{1,3})$/);
  const latDeg = match ? (match[1] === 'N' ? 1 : -1) * Math.min(90, Number(match[2])) : 0;
  const lonDeg = match ? (match[3] === 'W' ? 1 : -1) * Math.min(90, Number(match[4])) : 0;
  const offsetDeg =
    (Math.acos(
      Math.max(-1, Math.min(1, Math.cos((latDeg * Math.PI) / 180) * Math.cos((lonDeg * Math.PI) / 180)))
    ) *
      180) /
    Math.PI;

  const zone =
    offsetDeg <= halfAngleDeg
      ? 'CISLUNAR_AND_EARTH_DIRECT'
      : offsetDeg <= halfAngleDeg + 15
        ? 'FLANK_GLANCING_BLOW'
        : 'DEEP_SPACE_MISS';

  const isHit = zone !== 'DEEP_SPACE_MISS';
  const isS4 = scenarioTag === 'PEAK_STORM_S4';
  const speedKmS = isS4 ? 1120 : flareClass === 'X' ? 780 : flareClass === 'M' ? 580 : 410;
  const densityPcm3 = isS4 ? 28.0 : flareClass === 'X' ? 16.5 : flareClass === 'M' ? 10.0 : 4.8;
  const bzNt = isS4 ? -24.5 : flareClass === 'X' ? -13.5 : flareClass === 'M' ? -7.2 : -1.2;
  const cmeHours = Number((149597870.7 / (speedKmS * 1.2) / 3600).toFixed(1));
  const sepMin = isS4 ? 0 : isHit && flareClass !== 'C' ? 48 : null;
  const standoff = isS4 ? 5.5 : flareClass === 'X' ? 7.2 : flareClass === 'M' ? 8.6 : 10.6;

  return {
    activeScenario: scenarioTag ?? `CUSTOM (${flareClass} @ ${sourceLocation.toUpperCase()})`,
    currentTelemetry: { stormScale: isS4 ? 'S4_SEVERE' : 'S0_NOMINAL' },
    solarWind: {
      speedKmS,
      densityPcm3,
      bzNt,
      dynamicPressureNpa: Number((1.6726e-6 * densityPcm3 * speedKmS * speedKmS).toFixed(2)),
      parkerFootpointLonDeg: Number(((2.7e-6 * 149597870.7) / speedKmS * (180 / Math.PI)).toFixed(1)),
    },
    earlyWarning: {
      isWarningActive: isHit && flareClass !== 'C' && !isS4,
      estimatedProtonArrivalMinutes: sepMin,
      predictedStormScale: isS4 ? 'S4_SEVERE' : isHit && flareClass === 'X' ? 'S3_STRONG' : 'S0_NOMINAL',
    },
    impactPrediction: {
      sourceLocation: sourceLocation.toUpperCase(),
      sourceLatDeg: latDeg,
      sourceLonDeg: lonDeg,
      coneHalfAngleDeg: halfAngleDeg,
      magnetopauseStandoffRe: standoff,
      primaryImpactZone: zone,
      geomagneticGScale: isS4 ? 'G5' : isHit && flareClass === 'X' ? 'G3' : isHit && flareClass === 'M' ? 'G2' : 'G0',
      targets: [
        {
          target: 'EARTH_MAGNETOSPHERE',
          label: 'Earth Magnetosphere (LEO / GEO)',
          status: !isHit ? 'MISS' : standoff <= 6.6 ? 'DIRECT_HIT' : 'MAGNETOSPHERE_SHIELDED',
          impactProbabilityPct: isHit ? 85 : 5,
          estimatedArrivalMinutes: sepMin,
          cmeArrivalHours: isHit ? cmeHours : null,
          notes: '',
        },
        {
          target: 'CISLUNAR_TRANSIT',
          label: 'Cislunar Transit Corridor (Orion / EUS)',
          status: zone === 'CISLUNAR_AND_EARTH_DIRECT' ? 'DIRECT_HIT' : zone === 'FLANK_GLANCING_BLOW' ? 'GLANCING_BLOW' : 'MISS',
          impactProbabilityPct: isHit ? 92 : 8,
          estimatedArrivalMinutes: sepMin,
          cmeArrivalHours: isHit ? cmeHours : null,
          notes: '',
        },
        {
          target: 'GATEWAY_NRHO',
          label: 'Lunar Gateway (NRHO / L2)',
          status: zone === 'CISLUNAR_AND_EARTH_DIRECT' ? 'DIRECT_HIT' : zone === 'FLANK_GLANCING_BLOW' ? 'GLANCING_BLOW' : 'MISS',
          impactProbabilityPct: isHit ? 90 : 8,
          estimatedArrivalMinutes: sepMin,
          cmeArrivalHours: isHit ? cmeHours : null,
          notes: '',
        },
        {
          target: 'LUNAR_SURFACE',
          label: 'Lunar South Pole (HLS / 86.8° S)',
          status: zone === 'CISLUNAR_AND_EARTH_DIRECT' ? 'DIRECT_HIT' : zone === 'FLANK_GLANCING_BLOW' ? 'GLANCING_BLOW' : 'MISS',
          impactProbabilityPct: isHit ? 90 : 8,
          estimatedArrivalMinutes: sepMin,
          cmeArrivalHours: isHit ? cmeHours : null,
          notes: '',
        },
      ],
      summary:
        zone === 'DEEP_SPACE_MISS'
          ? `Source ${sourceLocation.toUpperCase()} misses the Earth–Moon corridor.`
          : `Source ${sourceLocation.toUpperCase()} impacts Cislunar Transit, Gateway NRHO, and Lunar South Pole (CME ETA ~${cmeHours}h).`,
    },
  };
}

interface OrbitTrajectoryViewerProps {
  scenario?: ScenarioId;
  onScenarioChange?: (next: ScenarioId) => void;
  shelterActive?: boolean;
}

export function OrbitTrajectoryViewer({
  scenario,
  onScenarioChange,
  shelterActive = false,
}: OrbitTrajectoryViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [sourceLocation, setSourceLocation] = useState('N14W42');
  const [flareClass, setFlareClass] = useState<'C' | 'M' | 'X'>('X');
  const [halfAngleDeg, setHalfAngleDeg] = useState(52);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'backend' | 'local'>('local');
  const [prediction, setPrediction] = useState<SolarWindPredictionState | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const pushToViewer = (payload: SolarWindPredictionState) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'artemis-host', type: 'solarWind', payload },
      window.location.origin
    );
  };

  // Sync with master scenario from VisualizerPage
  useEffect(() => {
    if (!scenario) return;
    const def = SCENARIO_DEFAULTS[scenario];
    setSourceLocation(def.source);
    setFlareClass(def.flareClass);
    setHalfAngleDeg(def.halfAngle);
    const state = buildLocalFallbackPrediction(def.source, def.flareClass, def.halfAngle, scenario);
    setPrediction(state);
    setDataSource('local');
    pushToViewer(state);
  }, [scenario]);

  // Sync Storm Shelter halo into 3D iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'artemis-host', type: 'shelterMode', active: shelterActive },
      window.location.origin
    );
  }, [shelterActive]);

  // Listen for scenario changes triggered inside the 3D iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.source === 'artemis-viewer' && e.data?.type === 'solarScenarioChanged') {
        const sc = e.data.scenario as string;
        if (sc === 'NOMINAL' || sc === 'FLARE_EARLY_WARNING' || sc === 'PEAK_STORM_S4') {
          onScenarioChange?.(sc);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onScenarioChange]);

  const runSimulation = async (loc: string, fClass: 'C' | 'M' | 'X', angle: number) => {
    if (!STONYHURST_REGEX.test(loc.trim())) {
      setValidationError('Use Stonyhurst format: e.g. N14W42 or S18E72 ([N/S]lat[E/W]lon).');
      return;
    }
    setValidationError(null);
    setIsSimulating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/api/radiation/predict-impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocation: loc.trim().toUpperCase(),
          flareClass: fClass,
          halfAngleDeg: angle,
        }),
      });
      if (!res.ok) throw new Error('Backend unavailable');
      const data = (await res.json()) as SolarWindPredictionState;
      setPrediction(data);
      setDataSource('backend');
      pushToViewer(data);
    } catch {
      const fallback = buildLocalFallbackPrediction(loc, fClass, angle);
      setPrediction(fallback);
      setDataSource('local');
      pushToViewer(fallback);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateImpact = (e: React.FormEvent) => {
    e.preventDefault();
    runSimulation(sourceLocation, flareClass, halfAngleDeg);
  };

  return (
    <div className="space-y-6">
      {/* 3D orbital viewer container */}
      <div
        className={`relative overflow-hidden border border-line bg-[#060911] transition-all duration-panel ease-out-expo ${
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
            : 'rounded-lg h-[620px] w-full'
        }`}
      >
        {/* Translucent top control bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          <div className="chrome-translucent flex items-center gap-2 rounded-pill border border-line px-3.5 py-1.5">
            <Orbit className="h-4 w-4 text-blueberry" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-blueberry tracking-wide">
              Artemis IV Flight Dynamics · NRHO &amp; Solar Wind
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/visualizer/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-press chrome-translucent flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:border-berry"
            >
              <ExternalLink className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              <span className="hidden sm:inline">Open in new tab</span>
            </a>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="tactile-press chrome-translucent flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:border-berry"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  <span>Exit fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Embedded 3D trajectory iframe */}
        <iframe
          ref={iframeRef}
          src="/visualizer/index.html"
          title="Orbvital 3D Artemis IV Flight Dynamics Viewer"
          className="h-full w-full border-0"
          loading="lazy"
          onLoad={() => {
            if (prediction) pushToViewer(prediction);
          }}
        />
      </div>

      {/* Solar Wind & Flare Impact Target Predictor */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2 text-blueberry text-sm font-semibold">
              <Wind className="h-4 w-4 text-berry" aria-hidden="true" />
              <span>Solar Wind &amp; Flare Impact Target Predictor</span>
            </div>
            <p className="mt-0.5 text-xs text-stem">
              Predicts Parker spiral connectivity, magnetopause compression, and arrival across cislunar targets. (3D magnetosphere &amp; CME wave use exaggerated visual scale.)
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-subtle px-2.5 py-1 font-mono text-[11px] text-blueberry">
            <Radio className="h-3 w-3 text-berry" aria-hidden="true" />
            {dataSource === 'backend' ? 'Backend Physics Engine' : 'Calibrated Local Physics'}
          </span>
        </div>

        {/* Quick-select presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-stem mr-1">Presets:</span>
          {SOURCE_PRESETS.map((p) => (
            <button
              key={p.source}
              type="button"
              onClick={() => {
                setSourceLocation(p.source);
                setFlareClass(p.flareClass);
                setHalfAngleDeg(p.halfAngle);
                runSimulation(p.source, p.flareClass, p.halfAngle);
              }}
              className={`tactile-press rounded-md border px-2.5 py-1 font-mono text-[11px] transition ${
                sourceLocation.toUpperCase() === p.source
                  ? 'border-berry bg-surface-hover text-blueberry font-semibold'
                  : 'border-line text-stem hover:text-blueberry'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="shrink-0">
            <SolarDiskPicker
              sourceLocation={sourceLocation}
              onSelect={(stonyhurst) => {
                setSourceLocation(stonyhurst);
                runSimulation(stonyhurst, flareClass, halfAngleDeg);
              }}
            />
          </div>

          <form onSubmit={handleSimulateImpact} className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="block text-xs text-stem">
              <span className="block mb-1 font-medium text-blueberry">Solar Source (Stonyhurst)</span>
              <input
                type="text"
                value={sourceLocation}
                onChange={(e) => {
                  setSourceLocation(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="e.g. N14W42 or S18E72"
                className="w-full rounded-md border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-blueberry focus:border-berry focus:outline-none"
              />
            </label>

            <label className="block text-xs text-stem">
              <span className="block mb-1 font-medium text-blueberry">Flare Class</span>
              <select
                value={flareClass}
                onChange={(e) => setFlareClass(e.target.value as 'C' | 'M' | 'X')}
                className="w-full rounded-md border border-line bg-canvas px-3 py-1.5 text-xs text-blueberry focus:border-berry focus:outline-none"
              >
                <option value="X">X-Class (Extreme)</option>
                <option value="M">M-Class (Moderate)</option>
                <option value="C">C-Class (Nominal)</option>
              </select>
            </label>

            <label className="block text-xs text-stem">
              <span className="block mb-1 font-medium text-blueberry">CME Cone Half-Angle (°)</span>
              <input
                type="number"
                min={15}
                max={85}
                value={halfAngleDeg}
                onChange={(e) => setHalfAngleDeg(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-canvas px-3 py-1.5 text-xs font-mono text-blueberry focus:border-berry focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={isSimulating}
              className="tactile-press rounded-md bg-blueberry px-4 py-1.5 text-xs font-semibold text-ink-inverse hover:opacity-90 disabled:opacity-50"
            >
              {isSimulating ? 'Simulating…' : 'Simulate in 3D Viewer'}
            </button>
          </form>
        </div>

        {validationError && (
          <p role="alert" className="text-xs font-mono text-status-critical">
            {validationError}
          </p>
        )}

        {prediction && (
          <div className="rounded-md border border-line bg-surface-subtle p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blueberry">
                {prediction.impactPrediction.primaryImpactZone === 'DEEP_SPACE_MISS' ? (
                  <ShieldCheck className="h-4 w-4 text-status-nominal" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-status-caution" aria-hidden="true" />
                )}
                <span>{prediction.impactPrediction.summary}</span>
              </div>
              <span className="font-mono text-xs text-stem tabular-nums">
                {Math.round(prediction.solarWind.speedKmS)} km/s · Bz {prediction.solarWind.bzNt} nT · Standoff{' '}
                {prediction.impactPrediction.magnetopauseStandoffRe} Re
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {prediction.impactPrediction.targets.map((t) => (
                <div key={t.target} className="rounded-md border border-line bg-canvas/50 px-3 py-2 text-xs">
                  <div className="font-semibold text-blueberry">{t.label}</div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                    <span
                      className={
                        t.status === 'DIRECT_HIT'
                          ? 'text-status-critical'
                          : t.status === 'GLANCING_BLOW'
                            ? 'text-status-caution'
                            : t.status === 'MAGNETOSPHERE_SHIELDED'
                              ? 'text-berry'
                              : 'text-stem'
                      }
                    >
                      {t.status}
                    </span>
                    <span className="text-stem tabular-nums">{t.impactProbabilityPct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orbital mechanics reference cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Globe className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>Trans-Lunar Injection (TLI)</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            SLS Block 1B accelerates the Orion spacecraft to{' '}
            <span className="tabular-nums font-medium text-blueberry">39,000 km/h</span> to escape
            low Earth orbit and enter the cislunar transfer arc.
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Orbit className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>Gateway NRHO Orbit</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            Near-Rectilinear Halo Orbit in{' '}
            <span className="tabular-nums font-medium text-blueberry">9:2</span> lunar resonance.
            Perilune at <span className="tabular-nums font-medium text-blueberry">3,000 km</span>{' '}
            (north pole) and apolune at{' '}
            <span className="tabular-nums font-medium text-blueberry">70,000 km</span> (south pole).
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Rocket className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>I-Hab Module &amp; Docking</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            Artemis IV delivers the ESA/JAXA International Habitat (I-Hab) to Gateway before
            lunar surface descent aboard Starship HLS.
          </p>
        </div>
      </div>
    </div>
  );
}
