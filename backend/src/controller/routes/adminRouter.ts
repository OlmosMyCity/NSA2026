/**
 * @module adminRouter
 * Express router mounting Flight Surgeon (`ADMIN`) triage and clinical directive endpoints.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminTriageController } from "../AdminTriageController.js";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";
import { PrismaCrewTriageRepository } from "../../repository/PrismaCrewTriageRepository.js";
import { GetTriageOverviewUseCase } from "../../service/admin/GetTriageOverviewUseCase.js";
import {
  ListAstronautDirectivesUseCase,
  SendClinicalDirectiveUseCase,
} from "../../service/admin/SendClinicalDirectiveUseCase.js";
import { PrismaDirectiveRepository } from "../../repository/PrismaDirectiveRepository.js";
import { radiationEngine } from "../../service/radiation/radiationEngine.js";
import { CreateUserByAdminUseCase } from "../../service/admin/CreateUserByAdminUseCase.js";
import { AssignMissionOperatorUseCase } from "../../service/admin/AssignMissionOperatorUseCase.js";
import { PrismaUserRepository } from "../../repository/PrismaUserRepository.js";
import { PrismaOperatorCrewRepository } from "../../repository/PrismaOperatorCrewRepository.js";
import { passwordHasher } from "../../security/PasswordHasher.js";

const crewRepo = new PrismaCrewTriageRepository();
const userRepo = new PrismaUserRepository();
const operatorCrewRepo = new PrismaOperatorCrewRepository();
const directiveRepo = new PrismaDirectiveRepository();
const controller = new AdminTriageController(
  // Si el motor de radiación no responde, el triaje sigue sin correlación de tormenta.
  new GetTriageOverviewUseCase(crewRepo, () => radiationEngine.getCurrentState().catch(() => null)),
  new SendClinicalDirectiveUseCase(crewRepo, directiveRepo),
  new ListAstronautDirectivesUseCase(crewRepo, directiveRepo),
  new CreateUserByAdminUseCase(userRepo, passwordHasher),
  new AssignMissionOperatorUseCase(userRepo, operatorCrewRepo),
  operatorCrewRepo
);

/** Router for `/api/admin` endpoints; all routes require JWT authentication and `Role.ADMIN`. */
export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles(Role.ADMIN));

adminRouter.get("/triage", controller.getTriageOverview);
adminRouter.get("/astronauts/:id/directives", controller.listAstronautDirectives);
adminRouter.post("/astronauts/:id/directives", controller.sendClinicalDirectives);
adminRouter.get("/operators", controller.listOperatorAccess);
adminRouter.post("/users", controller.createUser);
adminRouter.put("/missions/:id/operator", controller.assignMissionOperator);

