'use client';

/**
 * @module components/health/twin/ZoneSelector
 * Segmented radiogroup control linking Overview and the 5 anatomical zones
 * (`heart`, `brain`, `blood`, `bones`, `sleep`) to the 3D body camera focus.
 */

import { useRef, type KeyboardEvent } from 'react';
import { STATUS_THEME } from '../../../domain/health/status-theme';
import type { ZoneSummary } from '../../../domain/health/summary';
import type { BodyZoneId } from '../../../domain/health/types';

export const ZONE_ORDER: BodyZoneId[] = ['heart', 'brain', 'blood', 'bones', 'sleep'];

const SHORT_LABEL: Record<BodyZoneId, string> = {
  heart: 'Heart',
  brain: 'Brain',
  blood: 'Blood',
  bones: 'Bones',
  sleep: 'Sleep',
};

interface ZoneSelectorProps {
  zones: Record<BodyZoneId, ZoneSummary>;
  selected: BodyZoneId | null;
  onSelect: (zone: BodyZoneId | null) => void;
}

/** Accessible radiogroup segmented control synced with the 3D body viewer: Overview plus the 5 twin zones. */
export function ZoneSelector({ zones, selected, onSelect }: ZoneSelectorProps) {
  const options: (BodyZoneId | null)[] = [null, ...ZONE_ORDER];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onSelect(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Twin zone" className="twin-segmented">
      {options.map((zone, idx) => {
        const checked = selected === zone;
        const status = zone ? zones[zone].status : null;
        return (
          <button
            key={zone ?? 'overview'}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(zone)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className="twin-segment"
          >
            {status && (
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === 'red' ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: STATUS_THEME[status].color }}
              />
            )}
            <span className="truncate">{zone ? SHORT_LABEL[zone] : 'Overview'}</span>
            {status && <span className="sr-only">, {STATUS_THEME[status].label}</span>}
          </button>
        );
      })}
    </div>
  );
}

