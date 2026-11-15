/**
 * @module incidentRouter
 * Express router for clinical and mission contingency incidents, SSE notifications,
 * medical/mission catalogs, and RBAC-guarded lifecycle transitions.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { PrismaIncidentRepository } from "../../repository/PrismaIncidentRepository.js";
import { PrismaAstronautRepository } from "../../repository/PrismaAstronautRepository.js";
import { ListIncidentsUseCase } from "../../service/incident/ListIncidentsUseCase.js";
import { GetIncidentByIdUseCase } from "../../service/incident/GetIncidentByIdUseCase.js";
import { OpenIncidentUseCase } from "../../service/incident/OpenIncidentUseCase.js";
import { AcknowledgeIncidentUseCase } from "../../service/incident/AcknowledgeIncidentUseCase.js";
import { CloseIncidentUseCase } from "../../service/incident/CloseIncidentUseCase.js";
import { IncidentController } from "../IncidentController.js";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";

const incidentRepo = new PrismaIncidentRepository();
const astronautRepo = new PrismaAstronautRepository();

const controller = new IncidentController(
  new ListIncidentsUseCase(incidentRepo),
  new GetIncidentByIdUseCase(incidentRepo),
  new OpenIncidentUseCase(incidentRepo),
  new AcknowledgeIncidentUseCase(incidentRepo),
  new CloseIncidentUseCase(incidentRepo),
  astronautRepo,
  incidentRepo
);

/** Router mounted at `/api/incidents` (authenticated; opening/closing restricted to `ADMIN`). */
export const incidentRouter = Router();

incidentRouter.get("/", authenticate, controller.list);
incidentRouter.get("/stream", authenticate, controller.stream);
incidentRouter.get("/protocols", authenticate, controller.listProtocols);
incidentRouter.get("/mission-catalog", authenticate, controller.listMissionCatalog);
incidentRouter.get("/:id", authenticate, controller.getById);
incidentRouter.post("/", authenticate, authorizeRoles(Role.ADMIN), controller.open);
incidentRouter.patch("/:id/acknowledge", authenticate, controller.acknowledge);
incidentRouter.patch("/:id/close", authenticate, authorizeRoles(Role.ADMIN), controller.close);
