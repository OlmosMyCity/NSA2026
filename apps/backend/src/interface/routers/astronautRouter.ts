/**
 * @module astronautRouter
 * Express router composing crew profile CRUD, digital-twin evaluation/simulation,
 * health summaries, and admin-only crew mutations with optional multipart photo upload.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { AstronautController } from "../controllers/AstronautController.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { ListAstronautsUseCase } from "../../application/use-cases/astronaut/ListAstronautsUseCase.js";
import { GetAstronautByIdUseCase } from "../../application/use-cases/astronaut/GetAstronautByIdUseCase.js";
import { CreateAstronautUseCase } from "../../application/use-cases/astronaut/CreateAstronautUseCase.js";
import { UpdateAstronautUseCase } from "../../application/use-cases/astronaut/UpdateAstronautUseCase.js";
import { DeleteAstronautUseCase } from "../../application/use-cases/astronaut/DeleteAstronautUseCase.js";
import { ManageFaceBiometricsUseCase } from "../../application/use-cases/astronaut/ManageFaceBiometricsUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { astronautSummaryRouter } from "./healthReadingRouter.js";
import { DigitalTwinController } from "../controllers/DigitalTwinController.js";
import { operatorController } from "./operatorRouter.js";

const astronautRepo = new PrismaAstronautRepository();
const listAstronautsUseCase = new ListAstronautsUseCase(astronautRepo);
const getAstronautByIdUseCase = new GetAstronautByIdUseCase(astronautRepo);
const createAstronautUseCase = new CreateAstronautUseCase(astronautRepo);
const updateAstronautUseCase = new UpdateAstronautUseCase(astronautRepo);
const deleteAstronautUseCase = new DeleteAstronautUseCase(astronautRepo);
const faceBiometricsUseCase = new ManageFaceBiometricsUseCase();
const digitalTwinController = new DigitalTwinController();

const controller = new AstronautController(
  listAstronautsUseCase,
  getAstronautByIdUseCase,
  createAstronautUseCase,
  updateAstronautUseCase,
  deleteAstronautUseCase,
  astronautRepo,
  faceBiometricsUseCase
);

/** Router mounted at `/api/astronauts`. */
export const astronautRouter = Router();

astronautRouter.get("/", controller.list);
astronautRouter.get("/biometrics/gallery", authenticate, controller.getBiometricGallery);
astronautRouter.post("/digital-twin/evaluate", authenticate, digitalTwinController.evaluateStateless);
astronautRouter.use("/", astronautSummaryRouter); // GET /:id/summary
astronautRouter.get("/:id/digital-twin", authenticate, digitalTwinController.getDigitalTwin);
astronautRouter.post("/:id/simulate", authenticate, digitalTwinController.simulate);
astronautRouter.get("/:id/location", authenticate, operatorController.getLocation);
astronautRouter.patch("/:id/location", authenticate, operatorController.updateLocation);
astronautRouter.get("/:id/biometrics", authenticate, controller.listBiometrics);
astronautRouter.post(
  "/:id/biometrics",
  authenticate,
  authorizeRoles(Role.ADMIN, Role.USER),
  controller.enrollBiometric
);
astronautRouter.delete(
  "/:id/biometrics/:sampleId",
  authenticate,
  authorizeRoles(Role.ADMIN, Role.USER),
  controller.deleteBiometric
);
astronautRouter.get("/:id", controller.getById);
// Optional image: multipart payload with field "photo" or JSON with a pre-resolved "photoUrl".
const photoUpload = imageUpload("photo", "astronauts", "photoUrl");

astronautRouter.post("/", authenticate, authorizeRoles(Role.ADMIN), ...photoUpload, controller.create);
astronautRouter.put(
  "/:id",
  authenticate,
  authorizeRoles(Role.ADMIN, Role.USER),
  ...photoUpload,
  controller.update
);
astronautRouter.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete);

