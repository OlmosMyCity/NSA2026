'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Orbit,
  Rocket,
  Globe,
  ExternalLink,
  Upload,
  Satellite,
  Compass,
} from 'lucide-react';
import { VEHICLE_OPTIONS } from '../domain/missionSimulationConfig';

interface MissionTrajectoryPreset {
  id: string;
  label: string;
  environment: string;
  dataFile: string;
  subtitle: string;
  cards: { title: string; body: string }[];
}

const MISSION_PRESETS: MissionTrajectoryPreset[] = [
  {
    id: 'artemis-ii',
    label: 'Artemis II · Free-Return',
    environment: 'SPACECRAFT · CISLUNAR',
    dataFile: 'data/artemis_ii.json',
    subtitle: 'Free-Return Lunar Flyby (NASA)',
    cards: [
      {
        title: 'Trans-Lunar Injection (TLI)',
        body: 'SLS Block 1 accelerates Orion to ~10.9 km/s on a 4-day free-return trajectory around the Moon.',
      },
      {
        title: 'Lunar Far-Side Flyby',
        body: 'Orion passes ~7,400 km beyond the lunar far side before Earth gravity guides it back.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Deep-space radiation exposure outside Earth magnetosphere, fluid shift, and autonomous NHEJ repair monitoring.',
      },
    ],
  },
  {
    id: 'iss-leo',
    label: 'ISS Expedition 72 · Station',
    environment: 'SPACE STATION · LEO',
    dataFile: 'data/iss.json',
    subtitle: 'Low Earth Orbit (418 km, 51.6°)',
    cards: [
      {
        title: 'Orbital Mechanics (LEO)',
        body: '92.9-minute circular orbit at 7.66 km/s (~418 km altitude), experiencing 16 sunrises and sunsets per day.',
      },
      {
        title: 'Microgravity & Circadian',
        body: 'Continuous microgravity induces cephalad fluid shift, bone density loss, and circadian sleep disruption.',
      },
      {
        title: 'HRP Health Focus',
        body: 'ARED resistive countermeasures, blood pressure & glucose tracking, and separating sleep stress from radiation.',
      },
    ],
  },
  {
    id: 'lro-lunar',
    label: 'LRO · Lunar Polar Orbit',
    environment: 'LUNAR ORBITER · 50 KM',
    dataFile: 'data/lro.json',
    subtitle: 'Lunar Polar Orbit (50 km, 90°)',
    cards: [
      {
        title: 'Lunar Orbit Insertion (LOI)',
        body: '4.5-day cislunar transfer into a 50 km circular polar mapping orbit around the Moon.',
      },
      {
        title: 'Polar Illumination & Shadow',
        body: 'Continuous polar passes mapping permanently shadowed craters and Shackleton Crater rim.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Partial-gravity & lunar radiation dosimetry baseline for future surface crews.',
      },
    ],
  },
  {
    id: 'mars-2020',
    label: 'Mars 2020 · Perseverance',
    environment: 'DEEP SPACE · MARS',
    dataFile: 'data/mars2020.json',
    subtitle: 'Heliocentric Type-I Transfer (203 days)',
    cards: [
      {
        title: 'Trans-Mars Injection (TMI)',
        body: 'High-energy escape burn from LEO staging orbit onto a heliocentric interplanetary transfer trajectory.',
      },
      {
        title: 'Distance from Earth',
        body: 'Up to 22-minute one-way communication latency requires 100% autonomous crew self-triage and medical guidance.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Chronic GCR & SPE exposure, isolation/confinement mood tracking, and preventive oral radioprotectors.',
      },
    ],
  },
  {
    id: 'europa-clipper',
    label: 'Europa Clipper · Jupiter',
    environment: 'OUTER SYSTEM · JUPITER',
    dataFile: 'data/europa_clipper.json',
    subtitle: 'Mars & Earth Gravity Assists (2024–2030)',
    cards: [
      {
        title: 'Mars & Earth Gravity Assists',
        body: 'Launched Oct 14, 2024 on Falcon Heavy; uses Mars (Mar 2025) and Earth (Dec 2026) flybys to reach Jupiter.',
      },
      {
        title: 'Jovian Radiation Belt',
        body: 'Extreme trapped-particle radiation environment at Jupiter (~42,000 km closest approach in this cruise).',
      },
      {
        title: 'HRP Health Focus',
        body: 'Deep-space radiation shielding benchmarks and multi-year autonomous telemetry resilience.',
      },
    ],
  },
  {
    id: 'parker-solar-probe',
    label: 'Parker Solar Probe · Sun',
    environment: 'INNER SYSTEM · HELIOPHYSICS',
    dataFile: 'data/parker_solar_probe.json',
    subtitle: 'Venus Gravity Assist & Perihelion 1 (2018)',
    cards: [
      {
        title: 'Venus Gravity Assist',
        body: 'Launched Aug 12, 2018 on Delta IV Heavy; uses Venus flyby (~2,720 km altitude) to shed orbital angular momentum.',
      },
      {
        title: 'Perihelion 1 (24.8M km)',
        body: 'Reaches 24.8 million km from the Sun behind a 11.4 cm carbon-composite Thermal Protection System.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Solar Particle Event (SPE) early-warning telemetry and inner-heliosphere flux modeling.',
      },
    ],
  },
  {
    id: 'apollo-11',
    label: 'Apollo 11 · Lunar Landing',
    environment: 'LUNAR BASE · CREWED',
    dataFile: 'data/apollo_11.json',
    subtitle: 'Sea of Tranquility (July 16–24, 1969)',
    cards: [
      {
        title: 'Trans-Lunar Injection (TLI)',
        body: 'Saturn V S-IVB accelerated Columbia & Eagle out of 185 km LEO toward the Moon.',
      },
      {
        title: 'LM Eagle Powered Descent',
        body: 'Neil Armstrong and Buzz Aldrin landed in Mare Tranquillitatis on July 20, 1969 at 20:17:39 UTC.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Apollo biomedical telemetry: launch tachycardia, 1/6 g EVA heart rate spikes, and fluid-shift diuresis.',
      },
    ],
  },
  {
    id: 'apollo-13',
    label: 'Apollo 13 · Free-Return',
    environment: 'SPACECRAFT · CREWED',
    dataFile: 'data/apollo_13.json',
    subtitle: 'Cislunar Free-Return Abort (254 km)',
    cards: [
      {
        title: '254 km Pericynthion Flyby',
        body: 'After O2 tank #2 ruptured, LM Aquarius served as a lifeboat around the lunar far side.',
      },
      {
        title: 'Hypothermia & CO₂ Scrubbing',
        body: 'Cabin power-down dropped temperatures to 3°C while crew built square-to-round CO₂ scrubber adapters.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Sleep deprivation, dehydration, and cold-stress cardiovascular monitoring during 5.95-day abort.',
      },
    ],
  },
  {
    id: 'apollo-17',
    label: 'Apollo 17 · Taurus-Littrow',
    environment: 'LUNAR ROVER · CREWED',
    dataFile: 'data/apollo_17.json',
    subtitle: 'Taurus-Littrow Valley (Dec 7–19, 1972)',
    cards: [
      {
        title: '3 EVAs with Lunar Roving Vehicle',
        body: 'Gene Cernan and Harrison Schmitt traversed 35.9 km across Taurus-Littrow Valley over 22 h of EVA.',
      },
      {
        title: '12.58-Day Mission Duration',
        body: 'Longest Apollo lunar surface expedition with full orbital & surface physiological telemetry.',
      },
      {
        title: 'HRP Health Focus',
        body: '1/6 g musculoskeletal workload, lunar dust exposure, and post-EVA rehydration recovery.',
      },
    ],
  },
  {
    id: 'apollo-8',
    label: 'Apollo 8 · Lunar Orbit',
    environment: 'SPACECRAFT · CREWED',
    dataFile: 'data/apollo_8.json',
    subtitle: 'First Crewed Lunar Orbit (111 km)',
    cards: [
      {
        title: '10 Lunar Orbits at 111 km',
        body: 'Frank Borman, Jim Lovell, and Bill Anders became the first humans to leave Earth orbit (Dec 1968).',
      },
      {
        title: 'Trans-Earth Injection (TEI)',
        body: 'SPS burn behind the lunar far side returned Apollo 8 to a Pacific splashdown on Dec 27, 1968.',
      },
      {
        title: 'HRP Health Focus',
        body: 'First human deep-space radiation and space adaptation syndrome telemetry outside Van Allen belts.',
      },
    ],
  },
];

export function OrbitTrajectoryViewer() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('apollo-11');
  const [vehicleId, setVehicleId] = useState<string>('auto');
  const [customBlobUrl, setCustomBlobUrl] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (customBlobUrl) URL.revokeObjectURL(customBlobUrl);
    };
  }, [customBlobUrl]);

  const activePreset = MISSION_PRESETS.find((m) => m.id === selectedId) ?? MISSION_PRESETS[0];
  const dataParam = customBlobUrl ?? activePreset.dataFile;
  const iframeQuery = new URLSearchParams({ data: dataParam });
  if (vehicleId !== 'auto') iframeQuery.set('vehicle', vehicleId);
  const iframeSrc = `/mission-viewer/index.html?${iframeQuery.toString()}`;

  const handleUploadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { schema_version?: number; samples?: unknown; phases?: unknown };
      if (parsed.schema_version !== 1 || !parsed.samples || !parsed.phases) {
        throw new Error('Invalid trajectory JSON (requires schema_version: 1, phases, and samples).');
      }
      if (customBlobUrl) URL.revokeObjectURL(customBlobUrl);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setCustomBlobUrl(url);
      setCustomName(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to parse trajectory JSON.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectPreset = (id: string) => {
    if (customBlobUrl) {
      URL.revokeObjectURL(customBlobUrl);
      setCustomBlobUrl(null);
      setCustomName(null);
    }
    setUploadError(null);
    setSelectedId(id);
  };

  return (
    <div className="space-y-5">
      {/* Mission & Trajectory Selector + Upload JSON */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {MISSION_PRESETS.map((preset) => {
            const active = !customBlobUrl && selectedId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`tactile-press rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-blueberry text-white shadow-sm'
                    : 'border border-line bg-surface text-stem hover:text-blueberry'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Launch or spacecraft vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry"
          >
            {VEHICLE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                Vehicle: {v.label}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleUploadJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
          >
            <Upload className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
            <span>{customName ? `Custom: ${customName}` : 'Upload Trajectory (.json)'}</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {uploadError}
        </div>
      )}

      {/* 3D orbital viewer container */}
      <div
        className={`flex flex-col overflow-hidden border border-line bg-[#02040a] transition-all duration-panel ease-out-expo ${
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
            : 'rounded-lg h-[640px] w-full shadow-lg'
        }`}
      >
        {/* Clean header bar outside the 3D viewport (never overlaps HUD/controls) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#080f1e] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Orbit className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-slate-100 tracking-wide">
              {customName ? `Custom Trajectory · ${customName}` : `${activePreset.label} · ${activePreset.subtitle}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={iframeSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/30 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span className="hidden sm:inline">Open in new tab</span>
            </a>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/30 hover:text-white"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Exit fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title="Orbvital 3D Mission Trajectory Viewer"
          className="flex-1 w-full border-0 bg-[#02040a]"
          style={{ backgroundColor: '#02040a', colorScheme: 'dark' }}
        />
      </div>

      {/* Mission context cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activePreset.cards.map((card, idx) => {
          const Icon = idx === 0 ? Globe : idx === 1 ? Satellite : idx === 2 ? Rocket : Compass;
          return (
            <div key={card.title} className="surface-card p-5">
              <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
                <Icon className="h-4 w-4 text-berry" aria-hidden="true" />
                <span>{card.title}</span>
              </div>
              <p className="text-xs text-stem leading-relaxed">{card.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
