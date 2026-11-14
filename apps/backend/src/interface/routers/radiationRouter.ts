import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { radiationEngine } from "../../infrastructure/services/radiationEngine.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { parseWithValidation, radiationSimulateSchema } from "../validation/schemas.js";

export const radiationRouter = Router();

radiationRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const state = await radiationEngine.getCurrentState();
    res.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch radiation status";
    res.status(500).json({ error: message });
  }
});

radiationRouter.get("/cme-forecast", async (_req: Request, res: Response) => {
  try {
    const cmes = await radiationEngine.getCmeForecasts();
    res.json(cmes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch CME forecast";
    res.status(500).json({ error: message });
  }
});

radiationRouter.post(
  "/simulate",
  authenticate,
  authorizeRoles(Role.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scenario } = parseWithValidation(radiationSimulateSchema, req.body ?? {});

      if (!scenario || scenario === "RESET") {
        radiationEngine.setSimulationScenario(null);
        res.json({ message: "Simulation mode disabled. Using live NOAA/NASA telemetry." });
        return;
      }

      radiationEngine.setSimulationScenario(scenario);
      res.json({ message: `Simulation scenario activated: ${scenario}` });
    } catch (error) {
      next(error);
    }
  }
);
