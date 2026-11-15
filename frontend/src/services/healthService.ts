import { httpClient } from '@/services/httpClient';
import type { EvaluationResult, HealthReading, HealthReadingInput, Vitals } from '../domain/health/types';
import type { ApiHealthReading } from '../domain/health/api-adapter';
import { evaluateVitals } from '../domain/health/evaluate';
import type { Paginated } from '@/domain/common/pagination';


export const healthService = {
  /** Vista previa local con la misma tabla clínica que aplica el backend al guardar. */
  evaluate: (vitals: Vitals): EvaluationResult => evaluateVitals(vitals),

  /** El backend evalúa los signos vitales y persiste estado, alertas y protocolo. */
  createReading: (input: HealthReadingInput) => httpClient.post<HealthReading>('/readings', input),

  /** Lecturas de un astronauta, de la más antigua a la más reciente (para gráficas y dashboard). */
  async listReadings(astronautId: string, limit = 100): Promise<ApiHealthReading[]> {
    const res = await httpClient.get<Paginated<ApiHealthReading>>('/readings', { params: { astronautId, limit } });
    return [...res.data].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  },
};
