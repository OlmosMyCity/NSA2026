import type { ActiveRadiationIncidentSummary } from '../../domain/admin/types';

/** Incidente de tormenta solar S3+ activo (lo devuelve /api/admin/triage). */
export function RadiationIncidentBanner({ incident: activeRadiationIncident }: { incident: ActiveRadiationIncidentSummary }) {
  return (
    <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
            {activeRadiationIncident.stormScale} · INCIDENTE ACTIVO
          </span>
          <span className="text-xs font-mono text-rose-900">
            Estado: {activeRadiationIncident.status}
          </span>
        </div>
        <p className="mt-1 text-sm font-bold text-blueberry">
          {activeRadiationIncident.title}
        </p>
        <p className="text-xs text-blueberry/80">
          {activeRadiationIncident.description}
        </p>
      </div>
      <span className="text-xs font-semibold text-rose-900 bg-white/70 px-3 py-1.5 rounded border border-rose-500/30 self-start sm:self-auto">
        Protocolo adaptado: atención en refugio
      </span>
    </div>
  );
}
