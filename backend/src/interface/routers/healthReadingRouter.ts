import { Router } from "express";
import { HealthReadingController } from "../controllers/HealthReadingController.js";
import { PrismaHealthReadingRepository } from "../../infrastructure/repository/PrismaHealthReadingRepository.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { ListHealthReadingsUseCase } from "../../application/use-cases/health/ListHealthReadingsUseCase.js";
import { GetHealthReadingByIdUseCase } from "../../application/use-cases/health/GetHealthReadingByIdUseCase.js";
import { CreateHealthReadingUseCase } from "../../application/use-cases/health/CreateHealthReadingUseCase.js";
import { UpdateHealthReadingUseCase } from "../../application/use-cases/health/UpdateHealthReadingUseCase.js";
import { DeleteHealthReadingUseCase } from "../../application/use-cases/health/DeleteHealthReadingUseCase.js";
import { GetAstronautHealthSummaryUseCase } from "../../application/use-cases/health/GetAstronautHealthSummaryUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";

const readingRepo = new PrismaHealthReadingRepository();
const astronautRepo = new PrismaAstronautRepository();
const listHealthReadingsUseCase = new ListHealthReadingsUseCase(readingRepo);
const getHealthReadingByIdUseCase = new GetHealthReadingByIdUseCase(readingRepo);
const createHealthReadingUseCase = new CreateHealthReadingUseCase(readingRepo);
const updateHealthReadingUseCase = new UpdateHealthReadingUseCase(readingRepo);
const deleteHealthReadingUseCase = new DeleteHealthReadingUseCase(readingRepo);
const getAstronautHealthSummaryUseCase = new GetAstronautHealthSummaryUseCase(readingRepo);

const controller = new HealthReadingController(
  listHealthReadingsUseCase,
  getHealthReadingByIdUseCase,
  createHealthReadingUseCase,
  deleteHealthReadingUseCase,
  getAstronautHealthSummaryUseCase,
  updateHealthReadingUseCase,
  astronautRepo
);

export const readingRouter = Router();

readingRouter.get("/", authenticate, controller.list);
readingRouter.get("/:id", authenticate, controller.getById);
readingRouter.post("/", authenticate, controller.create);
readingRouter.put("/:id", authenticate, controller.update);
readingRouter.delete("/:id", authenticate, controller.delete);

// Router dedicado para el endpoint analítico del astronauta
export const astronautSummaryRouter = Router();
astronautSummaryRouter.get("/:id/summary", authenticate, controller.getSummary);
