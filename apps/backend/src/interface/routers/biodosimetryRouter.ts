import { Router } from "express";
import { BiodosimetryTriageUseCase } from "../../application/use-cases/health/BiodosimetryTriageUseCase.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { PrismaHealthReadingRepository } from "../../infrastructure/repository/PrismaHealthReadingRepository.js";
import { BiodosimetryController } from "../controllers/BiodosimetryController.js";
import { authenticate } from "../middlewares/authenticate.js";

const readingRepo = new PrismaHealthReadingRepository();
const astronautRepo = new PrismaAstronautRepository();
const triageUseCase = new BiodosimetryTriageUseCase(readingRepo, astronautRepo);
const controller = new BiodosimetryController(triageUseCase);

export const biodosimetryRouter = Router();

biodosimetryRouter.post("/biodosimetry-triage", authenticate, controller.triage);
