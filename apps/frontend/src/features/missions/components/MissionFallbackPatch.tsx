interface MissionFallbackPatchProps {
  className?: string;
  name?: string;
}

export function MissionFallbackPatch({
  className = 'h-16 w-16',
  name = 'Artemis Patch',
}: MissionFallbackPatchProps) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-lg bg-surface-tinted p-2 shrink-0 ${className}`}
      title={`Official mission patch: ${name}`}
      aria-label={`Official mission patch: ${name}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <polygon
          points="50,4 94,24 82,88 50,96 18,88 6,24"
          stroke="hsl(223, 29%, 26%)"
          strokeWidth="3"
          strokeLinejoin="round"
          fill="hsl(80, 14%, 96%)"
        />
        <ellipse
          cx="50"
          cy="48"
          rx="34"
          ry="13"
          transform="rotate(-25 50 48)"
          stroke="hsl(220, 20%, 45%)"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />
        <path
          d="M38,32 A18,18 0 1,0 62,56 A14,14 0 1,1 38,32 Z"
          fill="hsl(223, 29%, 26%)"
        />
        <polygon
          points="50,18 52,24 58,26 52,28 50,34 48,28 42,26 48,24"
          fill="hsl(220, 20%, 45%)"
        />
        <text
          x="50"
          y="80"
          textAnchor="middle"
          fill="hsl(223, 29%, 26%)"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="1"
        >
          NASA
        </text>
      </svg>
    </div>
  );
}

