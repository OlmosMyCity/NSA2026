/**
 * @module server
 * Standalone Express HTTP server exposing the Deep Space Radiation Prediction Engine API.
 *
 * Endpoints:
 * - `GET /health` — Service liveness probe.
 * - `GET /api/radiation/status` — Current live or simulated `RadiationEngineState`.
 * - `GET /api/radiation/cme-forecast` — Recent NASA DONKI CME analyses and WSA-ENLIL arrival forecasts.
 * - `POST /api/radiation/simulate` — Activates (`NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`) or resets (`RESET`) simulation mode.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RadiationEngine } from './index';
import { SimulationScenarioId } from './simulator/stormSimulator';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const engine = new RadiationEngine();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'Deep Space Radiation Prediction Engine', timestamp: new Date().toISOString() });
});

// Current space weather and radiation state (live telemetry or active simulation)
app.get('/api/radiation/status', async (_req, res) => {
  try {
    const state = await engine.getCurrentState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Coronal mass ejection (CME) forecast and WSA-ENLIL arrival estimates (NASA DONKI)
app.get('/api/radiation/cme-forecast', async (_req, res) => {
  try {
    const cmes = await engine.getCmeForecasts();
    res.json(cmes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simulation scenario trigger endpoint for live demonstrations
app.post('/api/radiation/simulate', (req, res) => {
  const { scenario } = req.body as { scenario: SimulationScenarioId | 'RESET' };

  if (scenario === 'RESET' || !scenario) {
    engine.setSimulationScenario(null);
    return res.json({ message: 'Simulation mode disabled. Using live NOAA/NASA telemetry.' });
  }

  if (['NOMINAL', 'FLARE_EARLY_WARNING', 'PEAK_STORM_S4'].includes(scenario)) {
    engine.setSimulationScenario(scenario as SimulationScenarioId);
    return res.json({ message: `Simulation scenario activated: ${scenario}` });
  }

  return res.status(400).json({
    error: 'Invalid scenario. Allowed values: NOMINAL, FLARE_EARLY_WARNING, PEAK_STORM_S4, RESET'
  });
});

app.listen(port, () => {
  console.log(`🚀 Deep Space Radiation Prediction Engine running on http://localhost:${port}`);
  console.log(`📡 Endpoints:`);
  console.log(`   - GET  /api/radiation/status`);
  console.log(`   - GET  /api/radiation/cme-forecast`);
  console.log(`   - POST /api/radiation/simulate`);
});
