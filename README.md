# 🌌 NASA Space Apps Challenge 2026 — Artemis Crew Health & Deep Space Radiation Engine

> **Repository:** [NSA2026](https://github.com/Josecopro/NSA2026)  
> **Challenge:** Create Health Monitoring Software for Astronauts on Space Missions  
> **Subject Area:** Human Spaceflight Hazards · Space Radiation Early Warning · Biomedical Dosimetry

---

## 🎯 Executive Overview

Long-duration missions outside Earth's protective magnetosphere (such as NASA's Artemis lunar exploration and upcoming Mars flights) expose astronauts to extreme spaceflight hazards, with **space radiation** identified by NASA's Human Research Program (HRP) as the single most critical threat to crew survival.

This project delivers a **Deep Space Radiation Prediction and Early Warning Engine** tightly coupled with astronaut health monitoring. Rather than functioning as a passive medical dashboard, the system proactively detects solar storms, computes relativistic particle arrival windows, models tissue-absorbed biological doses across shielding configurations, and triggers automated crew emergency protocols.

---

## ⚡ Core Scientific & Technical Capabilities

### 1. Zero-Latency Heliophysics Ingestion
- **NOAA SWPC Operational Models:** Directly ingests daily probabilistic forecasts (`solar_probabilities.json`) predicting 1-, 2-, and 3-day odds for C-, M-, and X-class solar flares, high-energy proton events ($>10\text{ MeV}$ SPE), and Polar Cap Absorption states.
- **GOES Satellites Telemetry:** Real-time 1-minute telemetry of X-ray flux ($0.05\text{--}0.4\text{ nm}$ and $0.1\text{--}0.8\text{ nm}$) and high-energy proton flux ($>10$, $>50$, $>100\text{ MeV}$) from primary GOES satellites.
- **NASA DONKI & WSA-ENLIL Modeling:** Ingests Coronal Mass Ejection (CME) shock arrival estimates and plasma velocities.

### 2. Relativistic Particle Transport & Early Warning Engine
High-energy solar protons travel at relativistic speeds ($E > 100\text{ MeV} \Rightarrow v \approx 0.43c$) through the interplanetary magnetic field:
$$v(E) = c \sqrt{1 - \left(\frac{m_p c^2}{E + m_p c^2}\right)^2}$$

By calculating the trajectory along the **interplanetary Parker Spiral** ($L \approx 1.25\text{ AU}$ with pitch-angle scattering), our engine identifies the $\sim 20\text{ to }90\text{ minute}$ operational window between the GOES X-ray flare detection and the peak proton storm impact in cis-lunar space.

### 3. Biological Dosimetry & Shielding Attenuation
In accordance with **NASA-STD-3001** (30-day limit: $250\text{ mSv}$, career cap: $500\text{ mSv}$):
- **EVA Spacesuit ($1.2\text{ g/cm}^2$):** $95\%$ flux transmission — extreme biological hazard without shelter.
- **Nominal Cabin ($10.0\text{ g/cm}^2$):** $75\%$ attenuation — baseline habitat shielding.
- **Crew Storm Shelter ($25.0\text{ g/cm}^2$):** $95.8\%$ attenuation — shielded bunker configuration utilizing water reserves, consumable supplies, and hydrogenated polyethylene panels.

### 4. Automated NOAA Scale & Medical Mitigation Protocol
- Classifies storm intensity from **$S0\text{ (Nominal)}$** up to **$S5\text{ (Extreme)}$**.
- Issues immediate operational and medical directives: abort EVA, initiate shelter ingress checklist, prepare antiemetics (Ondansetron), and administer radioprotective antioxidant regimens.

### 5. Interactive Demo Simulator for Judges
Enables real-time simulation of scenarios via API or SDK:
- `NOMINAL`: Quiet interplanetary background conditions.
- `FLARE_EARLY_WARNING`: X4.5 solar flare trigger with active 48-minute countdown to peak flux.
- `PEAK_STORM_S4`: Severe SPE event ($14,500\text{ pfu}$) demonstrating life-saving radiation attenuation in the Storm Shelter.

---

## 🏗️ Repository Architecture

```text
NSA2026/
├── docs/
│   ├── SPACE_RADIATION_MODULE_PLAN.md      # Detailed scientific and architectural roadmap
│   └── RADIATION_ENGINE_INTEGRATION_GUIDE.md # Frontend & Backend integration guide
└── radiation-engine/                       # Independent TypeScript engine & microservice
    ├── src/
    │   ├── types/index.ts                  # Domain models and strict interfaces
    │   ├── clients/
    │   │   ├── noaaSwpcClient.ts           # NOAA SWPC live feeds & fallback logic
    │   │   └── nasaDonkiClient.ts          # NASA DONKI WSA-ENLIL CME client
    │   ├── physics/
    │   │   ├── sepPrediction.ts            # Relativistic particle kinetics & warning window
    │   │   └── doseCalculator.ts           # Biological dose & shielding attenuation models
    │   ├── alert/
    │   │   └── mitigationRules.ts          # NOAA S1–S5 scales & emergency protocols
    │   ├── simulator/
    │   │   └── stormSimulator.ts           # Interactive scenario state generator
    │   ├── index.ts                        # Main exportable RadiationEngine SDK facade
    │   └── server.ts                       # REST API microservice (Express)
    └── tests/
        └── radiationEngine.test.ts         # Automated unit test suite (Vitest)
```

---

## 🚀 Quickstart

### 1. Running the Automated Test Suite
```bash
cd radiation-engine
npm install
npm test
```

### 2. Running In-Memory Engine Verification
```bash
npx ts-node src/cliTest.ts
```

### 3. Launching the REST API Microservice
```bash
npm run dev
# Server starts at http://localhost:4000
```

### Key API Endpoints:
- `GET /api/radiation/status`: Live space weather telemetry, early warning state, biological doses, and mitigation checklist.
- `GET /api/radiation/cme-forecast`: NASA DONKI CME shock arrival forecast.
- `POST /api/radiation/simulate`: Trigger demo scenarios (`FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, `NOMINAL`, `RESET`).

---

## 📚 References & Standards
- **NASA Human Research Program (HRP):** *The 5 Hazards of Human Spaceflight — Space Radiation* (<https://www.nasa.gov/hrp/hazards>)
- **NASA-STD-3001:** *NASA Spaceflight Human-System Standard: Crew Health and Habitability*
- **NOAA SWPC:** *Space Weather Scales for Solar Radiation Storms (S-Scale)* (<https://www.swpc.noaa.gov/noaa-scales-explanation>)
- **NASA DONKI:** *Space Weather Database Of Notifications, Knowledge, Information* (<https://kauai.ccmc.gsfc.nasa.gov/DONKI/>)
