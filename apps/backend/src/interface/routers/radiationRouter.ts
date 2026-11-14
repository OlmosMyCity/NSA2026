import { Router, Request, Response } from "express";
import { RadiationEngine } from "@nsa2026/radiation-engine";

type SimulationScenarioId = NonNullable<Parameters<RadiationEngine["setSimulationScenario"]>[0]>;

export const radiationRouter = Router();
const engine = new RadiationEngine();

radiationRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const state = await engine.getCurrentState();
    res.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch radiation status";
    res.status(500).json({ error: message });
  }
});

radiationRouter.get("/cme-forecast", async (_req: Request, res: Response) => {
  try {
    const cmes = await engine.getCmeForecasts();
    res.json(cmes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch CME forecast";
    res.status(500).json({ error: message });
  }
});

radiationRouter.post("/simulate", (req: Request, res: Response) => {
  const { scenario } = (req.body || {}) as { scenario?: SimulationScenarioId | "RESET" };

  if (!scenario || scenario === "RESET") {
    engine.setSimulationScenario(null);
    res.json({ message: "Simulation mode disabled. Using live NOAA/NASA telemetry." });
    return;
  }

  if (["NOMINAL", "FLARE_EARLY_WARNING", "PEAK_STORM_S4"].includes(scenario)) {
    engine.setSimulationScenario(scenario as SimulationScenarioId);
    res.json({ message: `Simulation scenario activated: ${scenario}` });
    return;
  }

  res.status(400).json({
    error: "Invalid scenario. Allowed values: NOMINAL, FLARE_EARLY_WARNING, PEAK_STORM_S4, RESET",
  });
});
