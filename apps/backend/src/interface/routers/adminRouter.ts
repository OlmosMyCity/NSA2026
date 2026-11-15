/**
 * @module adminRouter
 * Express router mounting Flight Surgeon (`ADMIN`) triage and clinical directive endpoints.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminTriageController } from "../controllers/AdminTriageController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";

const controller = new AdminTriageController();

/** Router for `/api/admin` endpoints; all routes require JWT authentication and `Role.ADMIN`. */
export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles(Role.ADMIN));

adminRouter.get("/triage", controller.getTriageOverview);
adminRouter.get("/astronauts/:id/directives", controller.listAstronautDirectives);
adminRouter.post("/astronauts/:id/directives", controller.sendClinicalDirectives);

