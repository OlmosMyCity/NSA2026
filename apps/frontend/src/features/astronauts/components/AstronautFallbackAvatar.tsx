interface AstronautFallbackAvatarProps {
  className?: string;
  name?: string;
}

/** Fallback EVA helmet silhouette rendered when an astronaut profile has no photo URL. */
export function AstronautFallbackAvatar({
  className = 'h-16 w-16',
  name = 'Astronaut',
}: AstronautFallbackAvatarProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-line bg-yogurt p-2 ${className}`}
      title={`Crew silhouette: ${name}`}
      aria-label={`Astronaut profile silhouette: ${name}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Subtle background */}
        <circle cx="50" cy="50" r="45" fill="hsl(80, 14%, 96%)" fillOpacity="0.65" />

        {/* EVA suit shoulders */}
        <path
          d="M18 92 C18 75, 32 70, 42 70 L58 70 C68 70, 82 75, 82 92 Z"
          fill="hsl(223, 29%, 26%)"
        />
        <path
          d="M20 92 C20 77, 33 72, 42 72 L58 72 C67 72, 80 77, 80 92"
          stroke="hsl(80, 14%, 96%)"
          strokeWidth="1.5"
          strokeOpacity="0.5"
        />

        {/* Neck ring */}
        <rect
          x="41"
          y="64"
          width="18"
          height="7"
          rx="2.5"
          fill="hsl(220, 20%, 45%)"
          stroke="hsl(80, 14%, 96%)"
          strokeWidth="1.5"
        />

        {/* Outer helmet */}
        <circle
          cx="50"
          cy="41"
          r="25"
          fill="hsl(80, 14%, 96%)"
          stroke="hsl(223, 29%, 26%)"
          strokeWidth="2.5"
        />

        {/* Visor */}
        <path
          d="M32 39 C32 29, 68 29, 68 39 C68 48, 62 53, 50 53 C38 53, 32 48, 32 39 Z"
          fill="hsl(223, 29%, 26%)"
        />

        {/* Subtle visor reflection */}
        <path
          d="M38 35 C43 32.5, 57 32.5, 62 35"
          stroke="hsl(27, 16%, 89%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />

        {/* Chest mission insignia */}
        <circle cx="50" cy="81" r="4" fill="hsl(27, 16%, 89%)" />
      </svg>
    </div>
  );
}

