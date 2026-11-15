/**
 * @module incidentRouter
 * Express router for clinical and mission contingency incidents, SSE notifications,
 * medical/mission catalogs, and RBAC-guarded lifecycle transitions.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { PrismaIncidentRepository } from "../../infrastructure/repository/PrismaIncidentRepository.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { ListIncidentsUseCase } from "../../application/use-cases/incident/ListIncidentsUseCase.js";
import { GetIncidentByIdUseCase } from "../../application/use-cases/incident/GetIncidentByIdUseCase.js";
import { OpenIncidentUseCase } from "../../application/use-cases/incident/OpenIncidentUseCase.js";
import { AcknowledgeIncidentUseCase } from "../../application/use-cases/incident/AcknowledgeIncidentUseCase.js";
import { CloseIncidentUseCase } from "../../application/use-cases/incident/CloseIncidentUseCase.js";
import { IncidentController } from "../controllers/IncidentController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";

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
