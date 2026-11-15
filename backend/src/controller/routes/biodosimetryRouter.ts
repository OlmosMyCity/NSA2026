/**
 * @module biodosimetryRouter
 * Express router exposing the authenticated acute radiation biodosimetry triage endpoint.
 */

import { Router } from "express";
import { BiodosimetryTriageUseCase } from "../../service/health/BiodosimetryTriageUseCase.js";
import { PrismaAstronautRepository } from "../../repository/PrismaAstronautRepository.js";
import { PrismaHealthReadingRepository } from "../../repository/PrismaHealthReadingRepository.js";
import { BiodosimetryController } from "../BiodosimetryController.js";
import { authenticate } from "../../security/authenticate.js";

const readingRepo = new PrismaHealthReadingRepository();
const astronautRepo = new PrismaAstronautRepository();
const triageUseCase = new BiodosimetryTriageUseCase(readingRepo, astronautRepo);
const controller = new BiodosimetryController(triageUseCase);

/** Router exposing `POST /biodosimetry-triage` behind JWT authentication. */
export const biodosimetryRouter = Router();

biodosimetryRouter.post("/biodosimetry-triage", authenticate, controller.triage);
