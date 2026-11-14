import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-canvas/85 py-10 text-stem">
      <div className="mx-auto max-w-container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <span className="text-sm font-bold tracking-tight text-blueberry">
              Orbvital · Artemis IV
            </span>
            <p className="mt-2.5 text-sm leading-relaxed text-stem max-w-md">
              Physiological monitoring and clinical risk assessment platform for the Artemis IV crew
              across cislunar orbit and the lunar surface.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-blueberry">
              Clinical Monitoring
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="hover:text-blueberry transition-colors">
                  Health status
                </Link>
              </li>
              <li>
                <Link href="/readings/new" className="hover:text-blueberry transition-colors">
                  Log reading
                </Link>
              </li>
              <li>
                <Link href="/trends" className="hover:text-blueberry transition-colors">
                  Trends
                </Link>
              </li>
              <li>
                <Link href="/routine" className="hover:text-blueberry transition-colors">
                  Daily routine
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-blueberry">
              Expedition
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/missions" className="hover:text-blueberry transition-colors">
                  Missions
                </Link>
              </li>
              <li>
                <Link href="/astronauts" className="hover:text-blueberry transition-colors">
                  Crew
                </Link>
              </li>
              <li>
                <Link href="/visualizer" className="hover:text-blueberry transition-colors">
                  3D Trajectory
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-blueberry transition-colors">
                  Surgeon console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stem">
          <span>Orbvital Crew Health · NASA Space Apps Challenge 2026</span>
          <span className="mt-2 sm:mt-0 text-berry font-medium">Human Research Program</span>
        </div>
      </div>
    </footer>
  );
}
