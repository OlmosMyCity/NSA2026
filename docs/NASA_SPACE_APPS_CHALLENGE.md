# NASA Space Apps Challenge 2026 — Health Monitoring Software for Astronauts

> Mapping the official 2026 NASA Space Apps Challenge requirements to **Orbvital (`NSA2026`)**.

---

## 1. Official Challenge Brief

**Create Health Monitoring Software for Astronauts on Space Missions**

- **Event:** 2026 NASA Space Apps Challenge
- **Difficulty:** Intermediate
- **Subjects:** Human Exploration · Software · Space Exploration

Long-duration missions expose astronauts to space radiation, isolation and confinement, distance from Earth, altered gravity fields, and a hostile closed environment—producing immune alterations, bone density loss, cardiovascular deconditioning, sleep disruption, and behavioral health risks. Under deep-space communication delays, astronauts must monitor, evaluate, and act autonomously on their own physiological status.

---

## 2. Clinical Threshold Matrix (7 NASA HRP Core Indicators)

| Indicator | Unit | Green (Nominal) | Amber (Warning) | Red (Critical / Flight Surgeon Alert) | NASA HRP Hazard Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Heart Rate (resting)** | bpm | `50–90` | `91–100` or `40–49` | `> 100` or `< 40` | Cardiovascular, Altered Gravity Fields |
| **Blood Pressure (Sys / Dia)** | mmHg | `< 130 / < 85` | `130–139 / 85–89` | `>= 140 / >= 90` or `< 90` sys | Cephalad Fluid Shift, Altered Gravity |
| **Blood Glucose** | mg/dL | `70–140` | `141–180` | `< 70` or `> 180` | Inadequate Nutrition, Metabolic Stress |
| **Body Temperature** | °C | `36.1–37.5` | `37.6–38.0` | `> 38.0` or `< 35.5` | Immune Changes, Space Radiation |
| **Oxygen Saturation (SpO₂)** | % | `>= 95` | `92–94` | `< 92` | Hostile Closed Environment (O₂/CO₂) |
| **Daily Sleep** | h/day | `>= 7.0` | `6.0–6.9` | `< 6.0` | Isolation, Confinement, Circadian Shift |
| **Behavioral Mood** | 1–5 | `4–5` | `3` | `1–2` | Behavioral Health, Distance from Earth |

> Note: Clinical thresholds inside Orbvital are operational heuristics aligned with NASA Human Research Program educational material for mission simulation and triage demonstration—not a replacement for certified flight medicine diagnosis.

---

## 3. Challenge Requirements -> Orbvital Implementation

| Challenge Requirement | How Orbvital Delivers It |
| :--- | :--- |
| **Gather multiple health inputs** | Guided vital entry wizard (`/readings/new`), free-text mood notes, instrument image checks, AND contactless cabin camera streaming (`vision` rPPG + PERCLOS + FERPlus syncing every 30s). |
| **Evaluate status & recommend actions** | Deterministic clinical rules engine (`evaluateReading.ts`, `decisionRules.ts`) computing alerts, action protocols (`re_measure`, `rest`, `exercise`, `shelter_shielding`, `contact_ground`), paired with on-demand **Gemini Decision 1** second-opinion triage. |
| **Clickable interactive human body** | Interactive **3D Anatomical Digital Twin** (`/dashboard`, `Body3D.tsx`) mapping **Heart**, **Brain**, **Blood**, **Bones**, and **Sleep** zones with color-coded glow and per-zone HRP hazard breakdowns. |
| **At-a-glance color coding** | Unified Green (`Nominal`), Amber (`Watch / Caution`), Red (`Critical`) encoding across 3D organs, indicator cards, trend charts, and Flight Surgeon priority badges. |
| **Dynamic longitudinal charts** | Time-series indicator history graphs (`/trends`) with threshold band overlays and slope detection. |
| **Habits, reminders & gamification** | Daily crew countermeasure checklist, measurement reminder cadence, compliance streak counter, and milestone badges (`/routine`). |
| **Multiple mission environments** | Habitat-specific exposure modeling (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`), **What-If Scenario Dock** in `/dashboard`, and interactive **3D Orbit & Trajectory Visualizer** (`/visualizer`). |
| **Ground Flight Surgeon escalation** | Automated database `Incident` creation (`MEDICAL` & `RADIATION`), cross-domain `P0_STORM_CRITICAL` shelter-in-place escalation during solar storms, real-time SSE alerts, and directive dispatch (`/admin`). |

---

## 4. Primary References

- NASA Human Research Program — *5 Hazards of Human Spaceflight*: <https://www.nasa.gov/hrp/hazards>
- NASA-STD-3001 — *Space Flight Human-System Standard* (Radiation & Environmental Health Limits)
- NOAA Space Weather Prediction Center (SWPC) & GOES X-Ray / Proton Operational Feeds
