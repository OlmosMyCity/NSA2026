/**
 * @module missionRouter
 * Express router for space mission listing, detail retrieval, and admin-only mutations
 * with optional multipart mission patch upload.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { MissionController } from "../controllers/MissionController.js";
import { PrismaMissionRepository } from "../../infrastructure/repository/PrismaMissionRepository.js";
import { ListMissionsUseCase } from "../../application/use-cases/mission/ListMissionsUseCase.js";
import { GetMissionByIdUseCase } from "../../application/use-cases/mission/GetMissionByIdUseCase.js";
import { CreateMissionUseCase } from "../../application/use-cases/mission/CreateMissionUseCase.js";
import { UpdateMissionUseCase } from "../../application/use-cases/mission/UpdateMissionUseCase.js";
import { DeleteMissionUseCase } from "../../application/use-cases/mission/DeleteMissionUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { imageUpload } from "../middlewares/imageUpload.js";

const missionRepo = new PrismaMissionRepository();
const listMissionsUseCase = new ListMissionsUseCase(missionRepo);
const getMissionByIdUseCase = new GetMissionByIdUseCase(missionRepo);
const createMissionUseCase = new CreateMissionUseCase(missionRepo);
const updateMissionUseCase = new UpdateMissionUseCase(missionRepo);
const deleteMissionUseCase = new DeleteMissionUseCase(missionRepo);

const controller = new MissionController(
  listMissionsUseCase,
  getMissionByIdUseCase,
  createMissionUseCase,
  updateMissionUseCase,
  deleteMissionUseCase
);

/** Router mounted at `/api/missions`. */
export const missionRouter = Router();

missionRouter.get("/", controller.list);
missionRouter.get("/:id", controller.getById);
// Optional image: multipart payload with field "patch" or JSON with a pre-resolved "patchUrl".
const patchUpload = imageUpload("patch", "missions", "patchUrl");

missionRouter.post("/", authenticate, authorizeRoles(Role.ADMIN), ...patchUpload, controller.create);
missionRouter.put("/:id", authenticate, authorizeRoles(Role.ADMIN), ...patchUpload, controller.update);
missionRouter.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete);
