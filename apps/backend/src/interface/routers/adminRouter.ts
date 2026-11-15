import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminTriageController } from "../controllers/AdminTriageController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { PrismaCrewTriageRepository } from "../../infrastructure/repository/PrismaCrewTriageRepository.js";
import { GetTriageOverviewUseCase } from "../../application/use-cases/admin/GetTriageOverviewUseCase.js";
import { SendClinicalDirectiveUseCase } from "../../application/use-cases/admin/SendClinicalDirectiveUseCase.js";
import { CreateUserByAdminUseCase } from "../../application/use-cases/admin/CreateUserByAdminUseCase.js";
import { AssignMissionOperatorUseCase } from "../../application/use-cases/admin/AssignMissionOperatorUseCase.js";
import { PrismaUserRepository } from "../../infrastructure/repository/PrismaUserRepository.js";
import { PrismaOperatorCrewRepository } from "../../infrastructure/repository/PrismaOperatorCrewRepository.js";
import { passwordHasher } from "../../infrastructure/services/PasswordHasher.js";

const crewRepo = new PrismaCrewTriageRepository();
const userRepo = new PrismaUserRepository();
const controller = new AdminTriageController(
  new GetTriageOverviewUseCase(crewRepo),
  new SendClinicalDirectiveUseCase(crewRepo),
  new CreateUserByAdminUseCase(userRepo, passwordHasher),
  new AssignMissionOperatorUseCase(userRepo, new PrismaOperatorCrewRepository())
);

export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles(Role.ADMIN));

adminRouter.get("/triage", controller.getTriageOverview);
adminRouter.post("/astronauts/:id/directives", controller.sendClinicalDirectives);
adminRouter.post("/users", controller.createUser);
adminRouter.put("/missions/:id/operator", controller.assignMissionOperator);

