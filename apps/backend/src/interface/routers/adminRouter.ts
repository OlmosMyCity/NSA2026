import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminTriageController } from "../controllers/AdminTriageController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { PrismaCrewTriageRepository } from "../../infrastructure/repository/PrismaCrewTriageRepository.js";
import { GetTriageOverviewUseCase } from "../../application/use-cases/admin/GetTriageOverviewUseCase.js";
import { SendClinicalDirectiveUseCase } from "../../application/use-cases/admin/SendClinicalDirectiveUseCase.js";

const crewRepo = new PrismaCrewTriageRepository();
const controller = new AdminTriageController(
  new GetTriageOverviewUseCase(crewRepo),
  new SendClinicalDirectiveUseCase(crewRepo)
);

export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles(Role.ADMIN));

adminRouter.get("/triage", controller.getTriageOverview);
adminRouter.post("/astronauts/:id/directives", controller.sendClinicalDirectives);

