# Deep Space Radiation Engine (`@nsa2026/radiation-engine`)

Standalone TypeScript heliophysics library and optional REST microservice that transforms live NOAA SWPC and NASA DONKI telemetry into relativistic Solar Particle Event (SPE) lead times, shielding-attenuated biological doses, solar-wind impact forecasts across cislunar/lunar zones, and operational mitigation checklists.

> In the **Orbvital** monorepo, `@nsa2026/radiation-engine` is imported directly by `apps/backend` (`src/infrastructure/services/radiationEngine.ts`) to expose `/api/radiation/*` without cold-start latency or extra hosting overhead. It can also be run standalone via `src/server.ts`.

---

## Core Physics & Space-Weather Pipeline (`src/`)

1. **Heliophysics Telemetry Clients (`src/clients/`)**:
   - `NoaaSwpcClient`: Ingests 1/2/3-day flare & proton probabilities (`solar_probabilities.json`), real-time 1-minute GOES X-ray flux (`0.1–0.8 nm`), $>10 / >50 / >100\text{ MeV}$ differential proton flux, and DSCOVR/ACE solar wind plasma + IMF magnetic field vectors (`bt`, `bz`, derived dynamic pressure in $\text{nPa}$).
   - `NasaDonkiClient`: Fetches WSA-ENLIL CME shock arrival predictions and source coordinates (`CMEAnalysis`).
2. **Relativistic Proton Transport & Early Warning (`src/physics/sepPrediction.ts`)**:
   - Evaluates GOES X-ray flux amplitude and rate of rise ($dF/dt$) to detect impulsive X-class / major M-class flares ($> M5$ or steep $> M2$ onset).
   - Computes relativistic speed $\beta = v/c$ for $50\text{–}100\text{ MeV}$ biologically hazardous protons and projects arrival along an effective $1.25\text{ AU}$ Parker Spiral path with pitch-angle scattering ($\times 2.0$), minus the $8.32\text{ min}$ photon transit offset—yielding a **20–90 minute early-warning countdown**.
3. **Biological Dosimetry & Shielding Attenuation (`src/physics/doseCalculator.ts`)**:
   - Converts proton flux ($\text{pfu}$ for $E > 10\text{ MeV}$, $\approx 2.5\ \mu\text{Sv/h}$ per pfu unshielded) plus a $1.8\ \mu\text{Sv/h}$ Galactic Cosmic Ray (GCR) background into effective dose rates ($\mu\text{Sv/h}$) and 30-day event projections ($\text{mSv}$) benchmarked against **NASA-STD-3001** ($250\text{ mSv}$ 30-day limit, $500\text{ mSv}$ reference cap):
     - `EVA_SUIT` ($1.2\text{ g/cm}^2$, transmission $0.95$)
     - `CREW_CABIN_NOMINAL` ($10.0\text{ g/cm}^2$, transmission $0.25$ / $75\%$ attenuation)
     - `STORM_SHELTER` ($25.0\text{ g/cm}^2$, transmission $0.04$ / $96\%$ attenuation)
4. **Solar Wind & Geomagnetic Impact Predictor (`src/physics/solarWindImpact.ts`)**:
   - Models CME cone angular hit probability from Stonyhurst active-region coordinates (e.g., `N14W42`) vs. western Parker Spiral magnetic connectivity across `EARTH_MAGNETOSPHERE`, `CISLUNAR_TRANSIT`, `GATEWAY_NRHO`, and `LUNAR_SURFACE` (including partial lunar wake attenuation in Earth's magnetotail near full moon).
5. **NOAA Scale Mitigation Engine (`src/alert/mitigationRules.ts`) & Scenario Simulator (`src/simulator/stormSimulator.ts`)**:
   - Maps flux to `S0_NOMINAL` through `S5_EXTREME`, generating immediate operational directives (`abortEvaImmediately`, `evacuateToStormShelter`, `powerDownExternalSensors`) and clinical countermeasures.
   - Simulates `NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, `SIDE_MISS_CME`, and parametric custom CME events.

---

## Library Usage

```typescript
import { RadiationEngine } from '@nsa2026/radiation-engine';

const engine = new RadiationEngine();
const liveState = await engine.getCurrentState();

// Demo rehearsal mode for flight readiness or judge walkthroughs
engine.setSimulationScenario('FLARE_EARLY_WARNING');
const warningState = await engine.getCurrentState();
```

---

## Scripts

```bash
npm run build   # Compile dist/ library and declarations via tsc
npm test        # Run Vitest suite (tests/radiationEngine.test.ts)
npm run dev     # Run standalone Express server (src/server.ts)
npx ts-node src/cliTest.ts # Run quick CLI diagnostic against engine physics
```

