import { Router } from "express";
import { Role } from "@prisma/client";
import { AstronautController } from "../controllers/AstronautController.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { ListAstronautsUseCase } from "../../application/use-cases/astronaut/ListAstronautsUseCase.js";
import { GetAstronautByIdUseCase } from "../../application/use-cases/astronaut/GetAstronautByIdUseCase.js";
import { CreateAstronautUseCase } from "../../application/use-cases/astronaut/CreateAstronautUseCase.js";
import { UpdateAstronautUseCase } from "../../application/use-cases/astronaut/UpdateAstronautUseCase.js";
import { DeleteAstronautUseCase } from "../../application/use-cases/astronaut/DeleteAstronautUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { astronautSummaryRouter } from "./healthReadingRouter.js";

const astronautRepo = new PrismaAstronautRepository();
const listAstronautsUseCase = new ListAstronautsUseCase(astronautRepo);
const getAstronautByIdUseCase = new GetAstronautByIdUseCase(astronautRepo);
const createAstronautUseCase = new CreateAstronautUseCase(astronautRepo);
const updateAstronautUseCase = new UpdateAstronautUseCase(astronautRepo);
const deleteAstronautUseCase = new DeleteAstronautUseCase(astronautRepo);

const controller = new AstronautController(
  listAstronautsUseCase,
  getAstronautByIdUseCase,
  createAstronautUseCase,
  updateAstronautUseCase,
  deleteAstronautUseCase
);

export const astronautRouter = Router();

astronautRouter.get("/", controller.list);
astronautRouter.use("/", astronautSummaryRouter); // GET /:id/summary
astronautRouter.get("/:id", controller.getById);
// Imagen opcional: multipart con el campo "photo" o JSON con "photoUrl" ya resuelta.
const photoUpload = imageUpload("photo", "astronauts", "photoUrl");

astronautRouter.post("/", authenticate, authorizeRoles(Role.ADMIN), ...photoUpload, controller.create);
astronautRouter.put("/:id", authenticate, authorizeRoles(Role.ADMIN), ...photoUpload, controller.update);
astronautRouter.delete("/:id", authenticate, authorizeRoles(Role.ADMIN), controller.delete);

