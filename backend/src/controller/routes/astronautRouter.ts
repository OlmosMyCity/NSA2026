/**
 * @module astronautRouter
 * Express router composing crew profile CRUD, digital-twin evaluation/simulation,
 * health summaries, and admin-only crew mutations with optional multipart photo upload.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { AstronautController } from "../AstronautController.js";
import { PrismaAstronautRepository } from "../../repository/PrismaAstronautRepository.js";
import { ListAstronautsUseCase } from "../../service/astronaut/ListAstronautsUseCase.js";
import { GetAstronautByIdUseCase } from "../../service/astronaut/GetAstronautByIdUseCase.js";
import { CreateAstronautUseCase } from "../../service/astronaut/CreateAstronautUseCase.js";
import { UpdateAstronautUseCase } from "../../service/astronaut/UpdateAstronautUseCase.js";
import { DeleteAstronautUseCase } from "../../service/astronaut/DeleteAstronautUseCase.js";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";
import { imageUpload } from "../../config/imageUpload.js";
import { astronautSummaryRouter } from "./healthReadingRouter.js";
import { DigitalTwinController } from "../DigitalTwinController.js";

const astronautRepo = new PrismaAstronautRepository();
const listAstronautsUseCase = new ListAstronautsUseCase(astronautRepo);
const getAstronautByIdUseCase = new GetAstronautByIdUseCase(astronautRepo);
const createAstronautUseCase = new CreateAstronautUseCase(astronautRepo);
const updateAstronautUseCase = new UpdateAstronautUseCase(astronautRepo);
const deleteAstronautUseCase = new DeleteAstronautUseCase(astronautRepo);
const digitalTwinController = new DigitalTwinController();

const controller = new AstronautController(
  listAstronautsUseCase,
  getAstronautByIdUseCase,
  createAstronautUseCase,
  updateAstronautUseCase,
  deleteAstronautUseCase
);

/** Router mounted at `/api/astronauts`. */
export const astronautRouter = Router();

astronautRouter.get("/", controller.list);
astronautRouter.post("/digital-twin/evaluate", authenticate, digitalTwinController.evaluateStateless);
astronautRouter.use("/", astronautSummaryRouter); // GET /:id/summary
astronautRouter.get("/:id/digital-twin", authenticate, digitalTwinController.getDigitalTwin);
astronautRouter.post("/:id/simulate", authenticate, digitalTwinController.simulate);
astronautRouter.get("/:id", controller.getById);
// Optional image: multipart payload with field "photo" or JSON with a pre-resolved "photoUrl".
const photoUpload = imageUpload("photo", "astronauts", "photoUrl");

astronautRouter.post("/", authenticate, authorizeRoles(Role.ADMIN), ...photoUpload, controller.create);
astronautRouter.put("/:id", authenticate, authorizeRoles(Role.ADMIN), ...photoUpload, controller.update);
astronautRouter.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete);

