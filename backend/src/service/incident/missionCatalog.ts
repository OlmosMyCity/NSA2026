/**
 * @module service/incident/missionCatalog
 * Standardized mission contingency catalog (`CONT-01`..`CONT-05`) providing default severity,
 * protocol identifiers, EVA-abort / module-evacuation flags, and checklists for `OpenIncidentUseCase`.
 *
 * Note: Contingency titles, descriptions, and action checklists are preserved in Spanish for
 * operational UI and unit-test contracts.
 */

import { IncidentCategory, IncidentSeverity } from "@prisma/client";

/** Canonical spacecraft/habitat emergency contingency identifiers. */
export type MissionContingencyType =
  | "DEPRESSURIZATION"
  | "FIRE_TOXIC_ATMOSPHERE"
  | "ECLSS_FAILURE"
  | "COMMS_LOSS"
  | "MISSION_ABORT";

/** Default incident template and operational response metadata for a mission contingency. */
export interface MissionContingencySpec {
  type: MissionContingencyType;
  code: string;
  category: IncidentCategory;
  defaultSeverity: IncidentSeverity;
  protocolId: string;
  title: string;
  description: string;
  abortEva: boolean;
  evacuateModule: boolean;
  immediateActions: string[];
}

/** Lookup registry of standardized mission contingency specifications. */
export const MISSION_CONTINGENCY_CATALOG: Record<MissionContingencyType, MissionContingencySpec> = {
  DEPRESSURIZATION: {
    type: "DEPRESSURIZATION",
    code: "CONT-01",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_DEPRESSURIZATION",
    title: "Despresurización de cabina / módulo",
    description:
      "Caída crítica de presión barométrica en módulo habitado. Riesgo inmediato de barotrauma, ebullismo e hipoxia.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Colocar cascos/trajes presurizados y verificar sellado de emergencia.",
      "Cerrar escotillas de aislamiento del módulo afectado.",
      "Activar suministro de O2/N2 de reserva y abortar EVA en curso.",
    ],
  },
  FIRE_TOXIC_ATMOSPHERE: {
    type: "FIRE_TOXIC_ATMOSPHERE",
    code: "CONT-02",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_FIRE_TOXIC_ATMOSPHERE",
    title: "Incendio o atmósfera tóxica a bordo",
    description:
      "Detección de humo, partículas o gases tóxicos (CO, NH3, HCN) en atmósfera cerrada.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Colocar respiradores de emergencia (PBA) de inmediato.",
      "Cortar ventilación del módulo afectado y desenergizar buses eléctricos no esenciales.",
      "Descargar supresor de incendios autorizado y purgar atmósfera antes de retirar PBA.",
    ],
  },
  ECLSS_FAILURE: {
    type: "ECLSS_FAILURE",
    code: "CONT-03",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_ECLSS_FAILURE",
    title: "Fallo de soporte vital (ECLSS)",
    description:
      "Falla en subsistema de control ambiental y soporte vital (generación de O2, depuración de CO2 o bucle térmico).",
    abortEva: true,
    evacuateModule: false,
    immediateActions: [
      "Conmutar a tren redundante de depuración de CO2 (CDRA/LiOH) y reserva de O2.",
      "Monitorear ppCO2 y SpO2 de la tripulación cada 15 minutos.",
      "Reducir carga metabólica de la tripulación y suspender EVA.",
    ],
  },
  COMMS_LOSS: {
    type: "COMMS_LOSS",
    code: "CONT-04",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_COMMS_LOSS",
    title: "Pérdida de comunicaciones con Control de Misión",
    description:
      "Interrupción prolongada de enlace bidireccional de telemetría y voz (LOS) con Tierra/Gateway.",
    abortEva: true,
    evacuateModule: false,
    immediateActions: [
      "Ejecutar protocolo autónomo de contingencia y conmutar a antena/banda S de respaldo.",
      "Almacenar telemetría biomédica localmente para retransmisión al recuperar enlace.",
      "Suspender operaciones EVA fuera de línea de vista hasta restablecer comunicaciones.",
    ],
  },
  MISSION_ABORT: {
    type: "MISSION_ABORT",
    code: "CONT-05",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_MISSION_ABORT",
    title: "Aborto de misión y retorno de emergencia",
    description:
      "Declaración de aborto de misión por contingencia mayor de vehículo, entorno o salud de tripulación.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Abortar todas las actividades de superficie/EVA y asegurar tripulación en vehículo de retorno.",
      "Preparar secuencia de desacoplamiento/ascenso de emergencia y soporte médico de reentrada.",
      "Notificar a Flight Director y Flight Surgeon para activación de equipos de recuperación.",
    ],
  },
};

/** Resolves a mission contingency specification by `type`, returning `null` for non-catalog types. */
export function getMissionContingencySpec(type: string): MissionContingencySpec | null {
  return (MISSION_CONTINGENCY_CATALOG as Record<string, MissionContingencySpec>)[type] ?? null;
}

/** Lists all standardized mission contingency specifications. */
export function listMissionContingencies(): MissionContingencySpec[] {
  return Object.values(MISSION_CONTINGENCY_CATALOG);
}
