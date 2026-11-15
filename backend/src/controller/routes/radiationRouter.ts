/**
 * @module radiationRouter
 * Express router exposing live NOAA/NASA space-weather status, CME forecasts,
 * admin-only deterministic storm simulation scenarios, and custom CME impact prediction.
 */

import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { RadiationEngineState } from "../../service/radiation/engine/index.js";
import { radiationEngine } from "../../service/radiation/radiationEngine.js";
import { PrismaIncidentRepository } from "../../repository/PrismaIncidentRepository.js";
import { OpenIncidentUseCase } from "../../service/incident/OpenIncidentUseCase.js";
import { openRadiationIncidentFromState } from "../../service/incident/syncSystemIncidents.js";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";
import { parseWithValidation, radiationSimulateSchema } from "../../dto/schemas.js";

const openIncidentUseCase = new OpenIncidentUseCase(new PrismaIncidentRepository());

/**
 * Synchronizes radiation storm state with persistent system incidents on a best-effort basis
 * so telemetry endpoints still respond if incident persistence fails.
 */
async function syncRadiationIncidentSafely(state: RadiationEngineState): Promise<void> {
  try {
    await openRadiationIncidentFromState(openIncidentUseCase, state);
  } catch (err) {
    console.warn("[RADIATION_INCIDENT_SYNC_ERROR]:", err instanceof Error ? err.message : err);
  }
}

/** Router mounted at `/api/radiation`. */
export const radiationRouter = Router();

radiationRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const state = await radiationEngine.getCurrentState();
    await syncRadiationIncidentSafely(state);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scenario } = parseWithValidation(radiationSimulateSchema, req.body ?? {});

      if (!scenario || scenario === "RESET") {
        radiationEngine.setSimulationScenario(null);
        res.json({ message: "Simulation mode disabled. Using live NOAA/NASA telemetry." });
        return;
      }

      radiationEngine.setSimulationScenario(scenario);
      const state = await radiationEngine.getCurrentState();
      await syncRadiationIncidentSafely(state);
      res.json({ message: `Simulation scenario activated: ${scenario}` });
    } catch (error) {
      next(error);
    }
  }
);

radiationRouter.post("/predict-impact", async (req: Request, res: Response) => {
  const body = (req.body || {}) as {
    sourceLocation?: string;
    flareClass?: "C" | "M" | "X";
    cmeSpeedKmS?: number;
    halfAngleDeg?: number;
    solarWindSpeedKmS?: number;
    densityPcm3?: number;
    bzNt?: number;
    moonPhaseAngleDeg?: number;
  };

  if (!body.sourceLocation || typeof body.sourceLocation !== "string") {
    res.status(400).json({ error: "sourceLocation is required (e.g. 'N14W42' or 'S18E72')" });
    return;
  }

  const state = radiationEngine.simulateCustomEvent({
    sourceLocation: body.sourceLocation,
    flareClass: body.flareClass,
    cmeSpeedKmS: body.cmeSpeedKmS,
    halfAngleDeg: body.halfAngleDeg,
    solarWindSpeedKmS: body.solarWindSpeedKmS,
    densityPcm3: body.densityPcm3,
    bzNt: body.bzNt,
    moonPhaseAngleDeg: body.moonPhaseAngleDeg,
  });

  if (state) {
    await syncRadiationIncidentSafely(state);
  }
  res.json(state);
});
