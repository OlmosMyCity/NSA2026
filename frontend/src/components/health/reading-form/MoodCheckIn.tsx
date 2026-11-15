import { useState } from 'react';

/** Las tres preguntas del check-in conductual (NASA HRP); el ánimo es su media redondeada. */
const QUESTIONS = [
  {
    id: 'energy',
    label: '1. Energy & Rest',
    options: ['Exhausted', 'Tired', 'Moderate fatigue', 'Rested', 'Fully energized'],
  },
  {
    id: 'focus',
    label: '2. Cognitive Focus',
    options: ['Disoriented', 'Brain fog', 'Slightly distracted', 'Nominal focus', 'Sharp & clear'],
  },
  {
    id: 'calm',
    label: '3. Stress & Isolation',
    options: ['Overwhelmed', 'Anxious / isolated', 'Mild tension', 'Steady', 'Calm & motivated'],
  },
] as const;

const SCORE_LABEL = ['Critical', 'Low', 'Fair', 'Good', 'Excellent'];

const SELECT_CLASS =
  'w-full border-0 border-b border-line bg-transparent py-1.5 px-0 text-xs text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry';

interface MoodCheckInProps {
  value: number;
  onChange: (mood: number) => void;
}

/** Check-in de ánimo de tres preguntas; entrega al formulario la puntuación compuesta 1–5. */
export function MoodCheckIn({ value, onChange }: MoodCheckInProps) {
  const [answers, setAnswers] = useState<number[]>(() => QUESTIONS.map(() => value));

  const answer = (index: number, level: number) => {
    const next = answers.map((a, i) => (i === index ? level : a));
    setAnswers(next);
    onChange(Math.round(next.reduce((sum, a) => sum + a, 0) / next.length));
  };

  return (
    <div className="space-y-4 sm:col-span-full">
      <div className="flex items-baseline justify-between gap-2">
        <span className="block text-xs font-semibold text-blueberry">Mood &amp; Behavioral Check-In (classified 1 – 5) *</span>
        <span className="text-xs font-mono font-semibold text-blueberry">
          Score: {value}/5 · {SCORE_LABEL[value - 1]}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUESTIONS.map((q, i) => (
          <label key={q.id} className="block text-[11px] text-stem">
            <span className="mb-1 block font-semibold text-blueberry">{q.label}</span>
            <select value={answers[i]} onChange={(e) => answer(i, Number(e.target.value))} className={SELECT_CLASS}>
              {[5, 4, 3, 2, 1].map((level) => (
                <option key={level} value={level}>
                  {level} - {q.options[level - 1]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <span className="block text-[11px] text-stem">Nominal: composite score 4 or 5 (NASA HRP behavioral health check-in)</span>
    </div>
  );
}
