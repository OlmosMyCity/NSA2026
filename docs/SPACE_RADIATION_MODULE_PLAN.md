# Technical Specification: Deep Space Radiation Early Warning Engine (`backend/src/service/radiation/engine`)

**Package:** `backend/src/service/radiation/engine`  
**Status:** Implemented & integrated into `backend`

---

## Architectural Summary

To deliver scientifically grounded space-weather forecasting under real-time constraints, the radiation engine combines **official operational forecasts (NOAA SWPC & NASA DONKI WSA-ENLIL)** with **real-time GOES X-ray derivative nowcasting and relativistic proton transport kinematics**.

---

## 1. Operational Heliophysics Ingestion (`src/clients/`)

1. **NOAA SWPC Probabilistic Forecast (`noaaSwpcClient.ts`):**
   - Consumes `https://services.swpc.noaa.gov/json/solar_probabilities.json` for 1-, 2-, and 3-day flare odds (Classes C, M, X), energetic proton event (`>10 MeV` SPE) probabilities, and Polar Cap Absorption status.
2. **GOES Primary Satellite Telemetry (`noaaSwpcClient.ts`):**
   - Streams 1-minute soft/hard X-ray flux (`0.1–0.8 nm`, mapping C/M/X flare classes) and integral proton fluxes (`>=10`, `>=50`, `>=100 MeV`), plus DSCOVR/ACE solar wind plasma speed, proton density, and IMF $B_t / B_z$ (computing dynamic ram pressure $P_{\text{dyn}}$ in $\text{nPa}$).
3. **NASA DONKI WSA-ENLIL (`nasaDonkiClient.ts`):**
   - Fetches Coronal Mass Ejection (`CMEAnalysis`) kinematics (half-angle, velocity in $\text{km/s}$, source Stonyhurst coordinates, and estimated shock arrival).
4. **Resilient Fallback:**
   - Partial feed degradation gracefully substitutes nominal baseline fields while preserving intact live sensors, or triggers offline fallback profiles when upstream networks are unreachable.

---

## 2. Relativistic SPE Transport & Early Warning (`src/physics/sepPrediction.ts`)

Computes the operational reaction window between X-ray flare observation (photons arriving in $8.32\text{ min}$) and peak arrival of biologically dangerous $50\text{–}100\text{ MeV}$ solar protons along interplanetary field lines:

1. **Flux Derivative Nowcasting ($dF/dt$):**
   - Monitors 1-minute GOES $0.1\text{–}0.8\text{ nm}$ X-ray flux for major flares ($\ge M5$, $5\times 10^{-5}\ \text{W/m}^2$) or rapid impulsive rises ($\ge M2$ with $dF/dt > 5\times 10^{-6}\ \text{W/m}^2/\text{min}$).
2. **Relativistic Proton Kinematics:**
   $$\beta(E) = \frac{v(E)}{c} = \sqrt{1 - \frac{1}{\gamma^2}}, \qquad \gamma = 1 + \frac{E}{m_p c^2}$$
3. **Parker Spiral Effective Path:**
   - Models an effective $1.25\text{ AU}$ curved interplanetary magnetic field path scaled by pitch-angle scattering ($\times 2.0$), minus the $8.32\text{ min}$ speed-of-light observation delay—yielding an actionable **$20\text{–}90\text{ min}$ warning lead window** (nominal $\sim 48\text{ min}$ for $100\text{ MeV}$ protons).

---

## 3. Biological Dosimetry & Shielding Attenuation (`src/physics/doseCalculator.ts`)

Converts $E > 10\text{ MeV}$ proton flux ($\text{pfu}$, using $2.5\ \mu\text{Sv/h}$ per unshielded $\text{pfu}$ plus $1.8\ \mu\text{Sv/h}$ Galactic Cosmic Ray background) into effective tissue dose rates and 30-day cumulative estimates evaluated against **NASA-STD-3001** ($250\text{ mSv}$ 30-day limit, $500\text{ mSv}$ reference cap):

| Shielding Configuration | Areal Density | Transmission Factor | Attenuation | Operational Profile |
| :--- | :--- | :--- | :--- | :--- |
| `EVA_SUIT` | $1.2\text{ g/cm}^2$ | `0.95` | $5\%$ | Minimal shielding; immediate EVA abort required on SPE onset |
| `CREW_CABIN_NOMINAL` | $10.0\text{ g/cm}^2$ | `0.25` | $75\%$ | Orion / Lunar Gateway aluminum-polymer nominal habitable volume |
| `STORM_SHELTER` | $25.0\text{ g/cm}^2$ | `0.04` | $96\%$ | Core compartment surrounded by potable water reserves & polyethylene shielding |

---

## 4. NOAA S1–S5 Mitigation Matrix & Solar Wind Target Exposure

- **NOAA Storm Classification (`mitigationRules.ts`):** Evaluates `S0_NOMINAL` ($<10\text{ pfu}$) up to `S5_EXTREME` ($\ge 100{,}000\text{ pfu}$), generating structured boolean triggers (`abortEvaImmediately`, `evacuateToStormShelter`, `powerDownExternalSensors`), medical countermeasures (antiemetics, oral radioprotector stacks, peripheral blood kits), and operational checklists.
- **Target Exposure Modeling (`solarWindImpact.ts`):** Maps CME angular half-cone width vs. Stonyhurst source coordinates (`N/S`, `E/W`) across `EARTH_MAGNETOSPHERE`, `CISLUNAR_TRANSIT`, `GATEWAY_NRHO`, and `LUNAR_SURFACE` (accounting for Earth magnetosphere shielding vs. lunar magnetotail crossing protection).
