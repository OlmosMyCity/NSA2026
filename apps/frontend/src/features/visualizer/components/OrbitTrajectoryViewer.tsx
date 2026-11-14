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
    id: 'artemis-iv',
    label: 'Artemis IV · Spacecraft',
    environment: 'SPACECRAFT · NRHO',
    dataFile: 'data/mission.json',
    subtitle: 'Cislunar Transfer & Gateway NRHO',
    cards: [
      {
        title: 'Trans-Lunar Injection (TLI)',
        body: 'SLS Block 1B accelerates Orion to 39,000 km/h to enter the cislunar transfer arc toward the Moon.',
      },
      {
        title: 'Gateway NRHO Orbit',
        body: '7-day elliptical Near-Rectilinear Halo Orbit (3,200 km perilune to 71,000 km apolune) minimizing eclipses.',
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
    dataFile: 'data/mission_iss_leo.json',
    subtitle: 'Low Earth Orbit (420 km, 51.6°)',
    cards: [
      {
        title: 'Orbital Mechanics (LEO)',
        body: '92-minute circular orbit at 7.66 km/s (~420 km altitude), experiencing 16 sunrises and sunsets per day.',
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
    id: 'lunar-base',
    label: 'Shackleton Base · Lunar Rover',
    environment: 'LUNAR BASE & ROVER',
    dataFile: 'data/mission_lunar_base.json',
    subtitle: 'South Pole Descent & Rover Traverse',
    cards: [
      {
        title: 'Powered Descent (HLS)',
        body: 'De-orbit from Low Lunar Orbit to the Shackleton Crater rim (86.8° S) with near-continuous solar illumination.',
      },
      {
        title: 'Pressurized Rover EVA',
        body: '12 km surface traverse in 1/6 g gravity with lunar regolith dust mitigation and EVA suit radiation dosimetry.',
      },
      {
        title: 'HRP Health Focus',
        body: 'Partial-gravity musculoskeletal loading, SpO2 monitoring during EVA, and rapid shelter ingress protocols.',
      },
    ],
  },
  {
    id: 'mars-transit',
    label: 'Ares I · Mars Transit',
    environment: 'DEEP SPACE · MARS',
    dataFile: 'data/mission_mars_transit.json',
    subtitle: 'Trans-Mars Injection & Cruise',
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
];

export function OrbitTrajectoryViewer() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('artemis-iv');
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
  const iframeSrc = customBlobUrl
    ? `/visualizer/index.html?data=${encodeURIComponent(customBlobUrl)}`
    : `/visualizer/index.html?data=${encodeURIComponent(activePreset.dataFile)}`;

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

        <div className="flex items-center gap-2">
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
        className={`flex flex-col overflow-hidden border border-line bg-[#060911] transition-all duration-panel ease-out-expo ${
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
          className="flex-1 w-full border-0"
          loading="lazy"
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
