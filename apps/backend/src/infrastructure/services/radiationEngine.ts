/**
 * @module radiationEngine
 * Shared in-process radiation simulation engine singleton.
 */

import { RadiationEngine } from "@nsa2026/radiation-engine";

/**
 * Shared RadiationEngine instance used by HTTP routes and in-process use cases
 * so simulation scenario state remains synchronized across endpoints.
 */
export const radiationEngine = new RadiationEngine();
