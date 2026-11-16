/**
 * @module IncidentController
 * HTTP and Server-Sent Events (SSE) controller for clinical and mission contingency incidents,
 * protocol/contingency catalogs, overdue SLA escalation, and RBAC-scoped crew notifications.
 */

import { Request, Response, NextFunction } from "express";
import { IncidentCategory, IncidentSeverity, IncidentStatus, Role } from "@prisma/client";
import { ListIncidentsUseCase } from "../service/incident/ListIncidentsUseCase.js";
import { GetIncidentByIdUseCase } from "../service/incident/GetIncidentByIdUseCase.js";
import { OpenIncidentUseCase } from "../service/incident/OpenIncidentUseCase.js";
import { AcknowledgeIncidentUseCase } from "../service/incident/AcknowledgeIncidentUseCase.js";
import { CloseIncidentUseCase } from "../service/incident/CloseIncidentUseCase.js";
import { IAstronautRepository } from "../repository/IAstronautRepository.js";
import { IIncidentRepository } from "../repository/IIncidentRepository.js";
import { ForbiddenError } from "../exception/AppError.js";
import { listMedicalProtocols } from "../service/health/medicalProtocols.js";
import { listMissionContingencies } from "../service/incident/missionCatalog.js";
import {
  escalateOverdueIncidents,
  incidentNotificationBus,
  IncidentNotificationEvent,
} from "../service/incident/incidentNotificationBus.js";
import { closeIncidentSchema, openIncidentSchema, parseWithValidation } from "../dto/schemas.js";

/**
 * Controller exposing `/api/incidents` REST endpoints and real-time SSE stream.
 */
export class IncidentController {
  constructor(
    private readonly listIncidentsUseCase: ListIncidentsUseCase,
    private readonly getIncidentByIdUseCase: GetIncidentByIdUseCase,
    private readonly openIncidentUseCase: OpenIncidentUseCase,
    private readonly acknowledgeIncidentUseCase: AcknowledgeIncidentUseCase,
    private readonly closeIncidentUseCase: CloseIncidentUseCase,
    private readonly astronautRepo?: IAstronautRepository,
    private readonly incidentRepo?: IIncidentRepository
  ) {}

  private async resolveOwnAstronautId(req: Request): Promise<string | null> {
    if (!req.user || !this.astronautRepo?.findByUserId) return null;
    const astro = await this.astronautRepo.findByUserId(req.user.id);
    return astro?.id ?? null;
  }

  /** `GET /api/incidents/protocols` — Returns the static catalog of medical response protocols. */
  listProtocols = (_req: Request, res: Response): void => {
    res.status(200).json({ data: listMedicalProtocols() });
  };

  /** `GET /api/incidents/mission-catalog` — Returns predefined mission contingency scenarios. */
  listMissionCatalog = (_req: Request, res: Response): void => {
    res.status(200).json({ data: listMissionContingencies() });
  };

  /**
   * `GET /api/incidents/stream` — Opens an SSE stream filtered by RBAC scope (global incidents
   * plus the caller's own astronaut incidents for `USER`, or all events for `ADMIN`),
   * emitting keepalive heartbeats and triggering overdue incident escalation every 20s.
   */
  stream = async (req: Request, res: Response): Promise<void> => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const ownAstronautId =
      req.user && req.user.role !== Role.ADMIN ? await this.resolveOwnAstronautId(req) : null;

    const canReceive = (event: IncidentNotificationEvent): boolean => {
      if (!req.user || req.user.role === Role.ADMIN) return true;
      return !event.incident.astronautId || event.incident.astronautId === ownAstronautId;
    };

    const writeEvent = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent("connected", { timestamp: new Date().toISOString() });

    const listener = (payload: IncidentNotificationEvent) => {
      if (canReceive(payload)) {
        writeEvent(payload.event, payload);
      }
    };

    incidentNotificationBus.on("incident-event", listener);

    if (this.incidentRepo) {
      await escalateOverdueIncidents(this.incidentRepo).catch(() => undefined);
    }

    const heartbeat = setInterval(() => {
      res.write(": keepalive\n\n");
      if (this.incidentRepo) {
        void escalateOverdueIncidents(this.incidentRepo).catch(() => undefined);
      }
    }, 20_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      incidentNotificationBus.off("incident-event", listener);
      res.end();
    });
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (this.incidentRepo) {
        await escalateOverdueIncidents(this.incidentRepo).catch(() => undefined);
      }
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        res.status(400).json({
          error: "Pagination parameters 'page' and 'limit' must be positive integers.",
        });
        return;
      }

      let astronautIdFilter = req.query.astronautId as string | undefined;
      let includeGlobal = false;
      let globalOnly = false;

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (astronautIdFilter && astronautIdFilter !== ownAstronautId) {
          throw new ForbiddenError("You do not have permission to view another crewmember's incidents.");
        }
        if (ownAstronautId) {
          astronautIdFilter = ownAstronautId;
          includeGlobal = true;
        } else {
          astronautIdFilter = undefined;
          globalOnly = true;
        }
      }

      const result = await this.listIncidentsUseCase.execute({
        page,
        limit,
        status: req.query.status as IncidentStatus | undefined,
        category: req.query.category as IncidentCategory | undefined,
        severity: req.query.severity as IncidentSeverity | undefined,
        astronautId: astronautIdFilter,
        includeGlobal,
        globalOnly,
        missionId: req.query.missionId as string | undefined,
        type: req.query.type as string | undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const incident = await this.getIncidentByIdUseCase.execute(req.params.id);

      if (req.user && req.user.role !== Role.ADMIN && incident.astronautId) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || incident.astronautId !== ownAstronautId) {
          throw new ForbiddenError("You do not have permission to view another crewmember's incidents.");
        }
      }

      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };

  open = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parseWithValidation(openIncidentSchema, req.body ?? {});
      const { incident, created } = await this.openIncidentUseCase.execute({
        ...payload,
        metadata: payload.metadata as Record<string, unknown> | undefined as never,
      });
      res.status(created ? 201 : 200).json({ ...incident, created });
    } catch (error) {
      next(error);
    }
  };

  acknowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user && req.user.role !== Role.ADMIN) {
        const existing = await this.getIncidentByIdUseCase.execute(req.params.id);
        if (existing.astronautId) {
          const ownAstronautId = await this.resolveOwnAstronautId(req);
          if (!ownAstronautId || existing.astronautId !== ownAstronautId) {
            throw new ForbiddenError("You do not have permission to acknowledge another crewmember's incidents.");
          }
        }
      }

      const incident = await this.acknowledgeIncidentUseCase.execute({
        id: req.params.id,
        userId: req.user!.id,
      });
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resolutionNotes } = parseWithValidation(closeIncidentSchema, req.body ?? {});
      const incident = await this.closeIncidentUseCase.execute({
        id: req.params.id,
        userId: req.user!.id,
        resolutionNotes,
      });
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };
}
