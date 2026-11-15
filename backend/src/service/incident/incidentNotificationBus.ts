/**
 * @module service/incident/incidentNotificationBus
 * In-process pub/sub notification bus and SLA escalation sweep for active operational,
 * medical, and radiation incidents (consumed by SSE streams and incident lifecycle use cases).
 */

import { EventEmitter } from "node:events";
import { Incident, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { IIncidentRepository } from "../../repository/IIncidentRepository.js";

/** Domain lifecycle event types emitted over the incident notification bus. */
export type IncidentEventType =
  | "incident:opened"
  | "incident:escalated"
  | "incident:acknowledged"
  | "incident:closed";

/** Structured SSE-ready payload broadcast whenever an incident transitions state. */
export interface IncidentNotificationEvent {
  event: IncidentEventType;
  incident: Incident;
  reason?: string;
  timestamp: string;
}

/** Default acknowledgment SLA windows (ms) by severity before automatic escalation. */
export const DEFAULT_ACK_TIMEOUT_MS: Record<IncidentSeverity, number> = {
  CRITICAL: 5 * 60 * 1000, // 5 minutes without acknowledgment
  WARNING: 15 * 60 * 1000, // 15 minutes without acknowledgment
};

class IncidentNotificationBus extends EventEmitter {
  publish(event: IncidentEventType, incident: Incident, reason?: string): void {
    const payload: IncidentNotificationEvent = {
      event,
      incident,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.emit("incident-event", payload);
  }
}

/** Shared singleton event bus bridging incident use cases to live SSE subscribers. */
export const incidentNotificationBus = new IncidentNotificationBus();

/**
 * Scans unacknowledged `OPEN` incidents whose acknowledgment SLA timeout has elapsed,
 * escalates them to `CRITICAL` once (guarded by `metadata.escalatedAt`), and emits
 * `incident:escalated` events.
 */
export async function escalateOverdueIncidents(
  incidentRepo: IIncidentRepository,
  now: Date = new Date(),
  timeouts: Record<IncidentSeverity, number> = DEFAULT_ACK_TIMEOUT_MS
): Promise<Incident[]> {
  const { data: openIncidents } = await incidentRepo.findAll({
    status: IncidentStatus.OPEN,
    page: 1,
    limit: 50,
  });

  const escalated: Incident[] = [];

  for (const incident of openIncidents) {
    const meta =
      incident.metadata && typeof incident.metadata === "object" && !Array.isArray(incident.metadata)
        ? (incident.metadata as Record<string, unknown>)
        : {};

    if (meta.escalatedAt) {
      continue;
    }

    const timeoutMs = timeouts[incident.severity] ?? DEFAULT_ACK_TIMEOUT_MS.WARNING;
    const elapsedMs = now.getTime() - new Date(incident.openedAt).getTime();
    if (elapsedMs < timeoutMs) {
      continue;
    }

    const updatedMeta: Prisma.InputJsonValue = {
      ...meta,
      escalated: true,
      escalatedAt: now.toISOString(),
      escalationReason: `Sin confirmación tras ${Math.round(elapsedMs / 60000)} min`,
    } as Prisma.InputJsonValue;

    const updated = await incidentRepo.update(incident.id, {
      severity: IncidentSeverity.CRITICAL,
      metadata: updatedMeta,
    });

    if (updated) {
      incidentNotificationBus.publish(
        "incident:escalated",
        updated,
        "Tiempo límite de confirmación excedido"
      );
      escalated.push(updated);
    }
  }

  return escalated;
}
