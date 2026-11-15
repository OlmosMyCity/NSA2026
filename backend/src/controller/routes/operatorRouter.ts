import { Router } from "express";
import { Role } from "@prisma/client";
import { OperatorController } from "../OperatorController.js";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";
import { PrismaOperatorCrewRepository } from "../../repository/PrismaOperatorCrewRepository.js";
import { PrismaAstronautRepository } from "../../repository/PrismaAstronautRepository.js";
import {
  GetOperatorCrewMemberUseCase,
  GetOperatorCrewOverviewUseCase,
} from "../../service/operator/GetOperatorCrewOverviewUseCase.js";
import {
  GetCrewLocationUseCase,
  UpdateCrewLocationUseCase,
} from "../../service/operator/UpdateCrewLocationUseCase.js";

const crewRepo = new PrismaOperatorCrewRepository();
const astronautRepo = new PrismaAstronautRepository();

export const operatorController = new OperatorController(
  new GetOperatorCrewOverviewUseCase(crewRepo),
  new UpdateCrewLocationUseCase(astronautRepo, crewRepo),
  new GetCrewLocationUseCase(astronautRepo, crewRepo),
  new GetOperatorCrewMemberUseCase(crewRepo)
);

/** Supervisión desde Tierra: solo lectura, solo rol OPERATOR y solo sus misiones. */
export const operatorRouter = Router();

operatorRouter.use(authenticate, authorizeRoles(Role.OPERATOR));
operatorRouter.get("/crew", operatorController.getCrewOverview);
operatorRouter.get("/crew/:astronautId", operatorController.getCrewMember);
