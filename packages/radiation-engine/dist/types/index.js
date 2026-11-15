"use strict";
/**
 * @module types
 * Domain contracts, telemetry schemas, and physical unit definitions for the
 * Deep Space Radiation Prediction Engine.
 *
 * Units used throughout these interfaces:
 * - Energy: MeV (megaelectronvolts)
 * - Distance: AU (astronomical units) and Re (Earth radii, ~6,371 km)
 * - X-ray flux: W/m^2 (watts per square meter in GOES 0.05-0.4 nm and 0.1-0.8 nm bands)
 * - Proton flux: pfu (particle flux units = protons / cm^2 / s / sr)
 * - Biological dose rate / cumulative dose: uSv/h and mSv (sieverts)
 * - Shielding areal density: g/cm^2
 * - Solar wind & IMF: km/s, p/cm^3, K, nT, nPa
 */
Object.defineProperty(exports, "__esModule", { value: true });
