import { Router } from "express";
import { Role } from "@prisma/client";
import { OperatorController } from "../controllers/OperatorController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { PrismaOperatorCrewRepository } from "../../infrastructure/repository/PrismaOperatorCrewRepository.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { GetOperatorCrewOverviewUseCase } from "../../application/use-cases/operator/GetOperatorCrewOverviewUseCase.js";
import { UpdateCrewLocationUseCase } from "../../application/use-cases/operator/UpdateCrewLocationUseCase.js";

const crewRepo = new PrismaOperatorCrewRepository();

export const operatorController = new OperatorController(
  new GetOperatorCrewOverviewUseCase(crewRepo),
  new UpdateCrewLocationUseCase(new PrismaAstronautRepository(), crewRepo)
);

/** Supervisión desde Tierra: solo lectura y solo para el rol OPERATOR. */
export const operatorRouter = Router();

operatorRouter.use(authenticate, authorizeRoles(Role.OPERATOR));
operatorRouter.get("/crew", operatorController.getCrewOverview);
