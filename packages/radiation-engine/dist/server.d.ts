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
export {};
