/**
 * @module service/incident/missionCatalog
 * Standardized mission contingency catalog (`CONT-01`..`CONT-05`) providing default severity,
 * protocol identifiers, EVA-abort / module-evacuation flags, and checklists for `OpenIncidentUseCase`.
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
    title: "Cabin / module depressurization",
    description:
      "Critical barometric pressure drop in an inhabited module. Immediate risk of barotrauma, ebullism, and hypoxia.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Don helmets/pressurized suits and verify emergency seal.",
      "Close isolation hatches on the affected module.",
      "Activate backup O2/N2 supply and abort any active EVA.",
    ],
  },
  FIRE_TOXIC_ATMOSPHERE: {
    type: "FIRE_TOXIC_ATMOSPHERE",
    code: "CONT-02",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_FIRE_TOXIC_ATMOSPHERE",
    title: "Onboard fire or toxic atmosphere",
    description:
      "Detection of smoke, particulates, or toxic gases (CO, NH3, HCN) in a closed cabin atmosphere.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Don emergency breathing masks (PBA) immediately.",
      "Shut off ventilation in the affected module and de-energize non-essential electrical buses.",
      "Discharge authorized fire suppressant and purge atmosphere before removing PBA.",
    ],
  },
  ECLSS_FAILURE: {
    type: "ECLSS_FAILURE",
    code: "CONT-03",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_ECLSS_FAILURE",
    title: "Life support failure (ECLSS)",
    description:
      "Environmental control and life support subsystem failure (O2 generation, CO2 scrubbing, or thermal loop).",
    abortEva: true,
    evacuateModule: false,
    immediateActions: [
      "Switch to redundant CO2 scrubbing train (CDRA/LiOH) and backup O2 reserve.",
      "Monitor crew ppCO2 and SpO2 every 15 minutes.",
      "Reduce crew metabolic load and suspend EVA.",
    ],
  },
  COMMS_LOSS: {
    type: "COMMS_LOSS",
    code: "CONT-04",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_COMMS_LOSS",
    title: "Loss of communications with Mission Control",
    description:
      "Prolonged interruption of bidirectional telemetry and voice link (LOS) with Earth/Gateway.",
    abortEva: true,
    evacuateModule: false,
    immediateActions: [
      "Execute autonomous contingency protocol and switch to backup S-band antenna.",
      "Buffer biomedical telemetry locally for retransmission upon link recovery.",
      "Suspend out-of-line-of-sight EVA operations until communications are restored.",
    ],
  },
  MISSION_ABORT: {
    type: "MISSION_ABORT",
    code: "CONT-05",
    category: IncidentCategory.MISSION,
    defaultSeverity: IncidentSeverity.CRITICAL,
    protocolId: "PROTO_MISSION_ABORT",
    title: "Mission abort and emergency return",
    description:
      "Mission abort declared due to major vehicle, environmental, or crew health contingency.",
    abortEva: true,
    evacuateModule: true,
    immediateActions: [
      "Abort all surface/EVA activities and secure crew inside the return vehicle.",
      "Prepare emergency undocking/ascent sequence and re-entry medical support.",
      "Notify Flight Director and Flight Surgeon to activate recovery teams.",
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
