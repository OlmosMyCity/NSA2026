/**
 * @module healthReadingRouter
 * Express routers for authenticated health reading CRUD, vision telemetry ingestion,
 * and astronaut multi-system clinical summary analytics.
 */

import { Router } from "express";
import { HealthReadingController } from "../controllers/HealthReadingController.js";
import { PrismaHealthReadingRepository } from "../../infrastructure/repository/PrismaHealthReadingRepository.js";
import { PrismaAstronautRepository } from "../../infrastructure/repository/PrismaAstronautRepository.js";
import { PrismaIncidentRepository } from "../../infrastructure/repository/PrismaIncidentRepository.js";
import { ListHealthReadingsUseCase } from "../../application/use-cases/health/ListHealthReadingsUseCase.js";
import { GetHealthReadingByIdUseCase } from "../../application/use-cases/health/GetHealthReadingByIdUseCase.js";
import { CreateHealthReadingUseCase } from "../../application/use-cases/health/CreateHealthReadingUseCase.js";
import { InvalidateHealthReadingUseCase } from "../../application/use-cases/health/InvalidateHealthReadingUseCase.js";
import { CorrectHealthReadingUseCase } from "../../application/use-cases/health/CorrectHealthReadingUseCase.js";
import { GetAstronautHealthSummaryUseCase } from "../../application/use-cases/health/GetAstronautHealthSummaryUseCase.js";
import { IngestVisionTelemetryUseCase } from "../../application/use-cases/health/IngestVisionTelemetryUseCase.js";
import { OpenIncidentUseCase } from "../../application/use-cases/incident/OpenIncidentUseCase.js";
import { authenticate } from "../middlewares/authenticate.js";

const readingRepo = new PrismaHealthReadingRepository();
const astronautRepo = new PrismaAstronautRepository();
const incidentRepo = new PrismaIncidentRepository();
const openIncidentUseCase = new OpenIncidentUseCase(incidentRepo);
const listHealthReadingsUseCase = new ListHealthReadingsUseCase(readingRepo);
const getHealthReadingByIdUseCase = new GetHealthReadingByIdUseCase(readingRepo);
const createHealthReadingUseCase = new CreateHealthReadingUseCase(readingRepo, openIncidentUseCase);
const invalidateHealthReadingUseCase = new InvalidateHealthReadingUseCase(readingRepo);
const correctHealthReadingUseCase = new CorrectHealthReadingUseCase(readingRepo, openIncidentUseCase);
const getAstronautHealthSummaryUseCase = new GetAstronautHealthSummaryUseCase(readingRepo);
const ingestVisionTelemetryUseCase = new IngestVisionTelemetryUseCase();

const controller = new HealthReadingController(
  listHealthReadingsUseCase,
  getHealthReadingByIdUseCase,
  createHealthReadingUseCase,
  invalidateHealthReadingUseCase,
  getAstronautHealthSummaryUseCase,
  correctHealthReadingUseCase,
  astronautRepo,
  ingestVisionTelemetryUseCase
);

/** Router mounted at `/api/readings` (all endpoints require authentication). */
export const readingRouter = Router();

readingRouter.get("/", authenticate, controller.list);
readingRouter.get("/:id", authenticate, controller.getById);
readingRouter.post("/", authenticate, controller.create);
readingRouter.post("/vision-ingest", authenticate, controller.ingestVision);
readingRouter.post("/:id/invalidate", authenticate, controller.invalidate);
readingRouter.post("/:id/corrections", authenticate, controller.correct);
// P1: health telemetry is strictly append-only
readingRouter.put("/:id", authenticate, controller.methodNotAllowed);
readingRouter.patch("/:id", authenticate, controller.methodNotAllowed);
readingRouter.delete("/:id", authenticate, controller.methodNotAllowed);

/** Dedicated router mounted under `/api/astronauts` for the astronaut clinical summary endpoint. */
export const astronautSummaryRouter = Router();
astronautSummaryRouter.get("/:id/summary", authenticate, controller.getSummary);
