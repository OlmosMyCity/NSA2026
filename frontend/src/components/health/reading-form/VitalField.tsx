import type { ReactNode } from 'react';
import { INDICATORS } from '../../../domain/health/indicators';
import { nominalLabel } from '../../../domain/health/evaluate';
import type { IndicatorId } from '../../../domain/health/types';
import { MOOD_OPTIONS } from './steps';

const FIELD_CLASS =
  'mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none';

interface VitalFieldProps {
  indicator: IndicatorId;
  value: number;
  onChange: (value: number) => void;
  badge?: ReactNode;
}

/** Campo de un signo vital con límites, paso y rango nominal tomados del catálogo. */
export function VitalField({ indicator, value, onChange, badge }: VitalFieldProps) {
  const def = INDICATORS[indicator];
  const id = `vital-${indicator}`;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-semibold text-blueberry">
          {def.label} ({def.unit}) *
        </label>
        {badge}
      </div>
      {indicator === 'mood' ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${FIELD_CLASS} [&>option]:bg-canvas [&>option]:text-blueberry`}
        >
          {MOOD_OPTIONS.map(([level, text]) => (
            <option key={level} value={level}>
              {level} - {text}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="number"
          required
          min={def.input.min}
          max={def.input.max}
          step={def.input.step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className={FIELD_CLASS}
        />
      )}
      <span className="text-[11px] text-stem mt-1.5 block tabular-nums">Nominal: {nominalLabel(indicator)}</span>
    </div>
  );
}
