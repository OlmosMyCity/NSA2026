# Integration Guide: Deep Space Radiation Engine (`backend/src/service/radiation/engine`)

This guide documents how `backend/src/service/radiation/engine` connects heliophysics feeds from NOAA SWPC and NASA DONKI into the Orbvital backend (`backend`) and Next.js frontend (`frontend`).

---

## 1. Integration Modes

Located in `backend/src/service/radiation/engine`, the engine runs embedded in the backend:
1. **Embedded TypeScript module:** Imported directly by `backend/src/service/radiation/radiationEngine.ts` and exposed through `/api/radiation/*` routes alongside automated `RADIATION` incident synchronization.

---

## 2. Backend REST Endpoints (`/api/radiation/*`)

### `GET /api/radiation/status`
Returns real-time (or active simulated) space-weather telemetry, relativistic early-warning state, shielding-attenuated biological doses, solar wind impact corridor predictions, and crew mitigation directives.

**Sample Response:**
```json
{
  "timestamp": "2026-11-14T14:58:14.494Z",
  "isSimulated": false,
  "probabilities": [
    {
      "date": "2026-11-14T00:00:00",
      "cClass1DayPct": 95,
      "mClass1DayPct": 60,
      "xClass1DayPct": 15,
      "protonEvent1DayPct": 15,
      "polarCapAbsorption": "green"
    }
  ],
  "currentTelemetry": {
    "latestXray": {
      "timestamp": "2026-11-14T14:48:00Z",
      "satellite": 18,
      "currentClass": "C1.2",
      "fluxLong": 7.26e-7,
      "derivativePerMinute": 1.2e-8
    },
    "stormScale": "S0_NOMINAL"
  },
  "earlyWarning": {
    "isWarningActive": true,
    "triggerEvent": "High-Energy Solar Flare (X4.5) detected by GOES-18",
    "flareOnsetTimestamp": "2026-11-14T14:45:00Z",
    "estimatedProtonArrivalMinutes": 48,
    "estimatedPeakFluxPfu": 12000,
    "predictedStormScale": "S4_SEVERE",
    "confidenceScore": 0.88
  },
  "biologicalDoses": {
    "EVA_SUIT": {
      "shieldingType": "EVA_SUIT",
      "doseRateMicroSvPerHour": 12.3,
      "projected30DayDoseMsv": 1.54,
      "careerDosePercentage": 0.3,
      "clinicalRiskLevel": "NOMINAL"
    },
    "CREW_CABIN_NOMINAL": {
      "shieldingType": "CREW_CABIN_NOMINAL",
      "doseRateMicroSvPerHour": 4.43,
      "projected30DayDoseMsv": 1.38,
      "careerDosePercentage": 0.3,
      "clinicalRiskLevel": "NOMINAL"
    },
    "STORM_SHELTER": {
      "shieldingType": "STORM_SHELTER",
      "doseRateMicroSvPerHour": 2.22,
      "projected30DayDoseMsv": 1.33,
      "careerDosePercentage": 0.3,
      "clinicalRiskLevel": "NOMINAL"
    }
  },
  "mitigation": {
    "stormScale": "S4_SEVERE",
    "abortEvaImmediately": true,
    "evacuateToStormShelter": true,
    "powerDownExternalSensors": true,
    "medicalCountermeasures": [
      "Administer prophylactic antiemetic to prevent acute motion/radiation sickness"
    ],
    "actionChecklist": [
      "Abort all EVA operations; depressurize/repressurize airlock on rapid emergency cycle",
      "Crew ingress to dedicated Storm Shelter within 20 minutes"
    ]
  }
}
```

### `GET /api/radiation/cme-forecast`
Returns latest NASA DONKI WSA-ENLIL Coronal Mass Ejection shock analyses.

### `POST /api/radiation/simulate` *(Admin Only)*
Activates demonstration scenarios for operational drills or judge walkthroughs and immediately synchronizes any resulting `RADIATION` incident:
```json
{
  "scenario": "FLARE_EARLY_WARNING"
}
```
Allowed values: `"NOMINAL"`, `"FLARE_EARLY_WARNING"`, `"PEAK_STORM_S4"`, `"SIDE_MISS_CME"`, `"RESET"`.

### `POST /api/radiation/predict-impact`
Evaluates custom synthetic CME/flare parameters (`sourceLocation`, `flareClass`, `cmeSpeedKmS`, `halfAngleDeg`, `solarWindSpeedKmS`, `densityPcm3`, `bzNt`, `moonPhaseAngleDeg`) across Earth magnetosphere, cislunar corridor, Gateway NRHO, and Lunar South Pole targets.

---

## 3. Direct TypeScript SDK Usage

```typescript
import { RadiationEngine } from './service/radiation/engine/index.js';

const engine = new RadiationEngine();
const state = await engine.getCurrentState();

// Toggle scenario simulation programmatically
engine.setSimulationScenario('FLARE_EARLY_WARNING');
```

---

## 4. Frontend UI Patterns

1. **Global Radiation Banner (`RadiationStatusBanner.tsx`):** Polls live storm telemetry and displays actionable early-warning countdowns and emergency checklists.
2. **Digital Twin Coupling (`/dashboard`):** Feeds `stormScale` and selected habitat shielding (`EVA_SUIT`, `CREW_CABIN_NOMINAL`, `STORM_SHELTER`) into both the NASA HRP hazard load bars and Gemini Decision 1 triage context.
3. **Cross-Domain Incident Escalation (`/admin`):** Automatically promotes `CRITICAL` crew readings during `S3+` solar storms to `P0_STORM_CRITICAL` shelter-in-place protocols.
