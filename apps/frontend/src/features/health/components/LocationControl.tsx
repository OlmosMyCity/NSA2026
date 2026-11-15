'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { CREW_LOCATIONS, CREW_LOCATION_LABEL, type CrewLocation } from '@/features/operator/domain/types';

/** El tripulante declara dónde está; es lo que ve el operador en Tierra. */
export function LocationControl({ astronautId }: { astronautId: string }) {
  const [location, setLocation] = useState<CrewLocation | ''>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    astronautService
      .getLocation(astronautId)
      .then((current) => {
        if (active) setLocation(current ?? '');
      })
      .catch(() => {
        // Sin conexión el selector queda sin valor; se puede declarar igual.
      });
    return () => {
      active = false;
    };
  }, [astronautId]);

  const handleChange = async (next: CrewLocation) => {
    const previous = location;
    setLocation(next); // respuesta inmediata; se revierte si el servidor rechaza
    setError(false);
    try {
      await astronautService.updateLocation(astronautId, next);
    } catch {
      setLocation(previous);
      setError(true);
    }
  };

  return (
    <label className="flex items-center gap-2">
      <span className="twin-label flex items-center gap-1.5">
        <MapPin className="h-3 w-3" aria-hidden="true" />
        My location
      </span>
      <select
        value={location}
        onChange={(e) => void handleChange(e.target.value as CrewLocation)}
        aria-invalid={error}
        className="twin-select w-auto min-w-[9rem]"
      >
        <option value="" disabled>
          Not reported
        </option>
        {CREW_LOCATIONS.map((value) => (
          <option key={value} value={value}>
            {CREW_LOCATION_LABEL[value]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-status-critical">
          Not saved
        </span>
      )}
    </label>
  );
}
