# 01 — Home / Landing

| | |
| :--- | :--- |
| **Ruta** | `/` |
| **Archivo** | `apps/frontend/src/app/page.tsx` |
| **Componentes** | `AppLayout` → `HeroSection`, `HazardsSection` |
| **Acceso** | Público (con o sin sesión) |
| **Objetivo** | Presentar la propuesta de valor y llevar al usuario a registrar una lectura o explorar la órbita 3D. |

## Desktop (≥ lg, 12 columnas)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ORBVITAL   ▌Home  My Health  Log Reading  Routine  Missions  3D Orbit  Crew          │
│                                                            (⇥ Sign in) [Register]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░░░░░░░░░ fondo web1.jpg (espacio) ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                                                      │
│  ── HERO (col 1-7) ─────────────────────────────┐   ── LEDGER (col 8-12) ──────────  │
│                                                 │                                    │
│  To deep space                                  │   SITE        SHACKLETON · 86.8°S  │
│  and back, safely.            (display, XL)     │   GRAVITY     0.166 g (1/6 EARTH)  │
│                                                 │   ORBIT_RES   NRHO 9:2 · GATEWAY   │
│  Crewed spaceflight vitals, 5 biomedical        │   TELEMETRY   ● 7 VITALS // LINKED │
│  hazards, and flight surgeon link.              │               (verde nominal)      │
│                                                 │                                    │
│  [ Log Reading → ]   ( ◎ 3D NRHO ORBIT )        │   (mono, sin caja, alineado abajo) │
│ ────────────────────────────────────────────────┴─────────────────────────────────── │
│                                                                                      │
│  The 5 Hazards of Spaceflight                                  ( EVALUATE METRICS → )│
│  NASA HRP physiological risks mapped to onboard vitals.                              │
│                                                                                      │
│ ┌─ surface-card ───────────────────────────────────────────────────────────────────┐ │
│ │ RAIL (col 1-4)              │ DOSSIER (col 5-12)                                  │ │
│ │                             │                                                     │ │
│ │ ▌[R] Space Radiation    ☢   │  ☢ Space Radiation              HAZARD_REF // [R]   │ │
│ │      Galactic Cosmic Rays   │                                                     │ │
│ │  [I] Isolation &        👥  │  GCR and solar particle events outside Earth's      │ │
│ │      Confinement            │  magnetosphere.                                     │ │
│ │      Behavioral Health      │                                                     │ │
│ │  [D] Distance from      🧭  │  ⚠ PHYSIOLOGICAL IMPACT     ✓ COUNTERMEASURE        │ │
│ │      Earth                  │  Cellular damage, oxidative Polyethylene habitat    │ │
│ │      Autonomous Care        │  stress, immunosuppression… shielding + real-time…  │ │
│ │  [G] Altered Gravity    ⚖   │                                                     │ │
│ │      (0.166g)               │  REFERENCE_PARAMETERS              UNIT: °C / bpm   │ │
│ │      Vestibular & Fluid     │  INDICATOR        NOMINAL          CRITICAL         │ │
│ │  [H] Hostile Closed     ☣   │  Body Temp &      36.1 – 37.5 °C   > 38.0 °C or     │ │
│ │      Environments           │  Heart Rate       (verde)          HR > 100 (rojo)  │ │
│ │      Habitat Atmosphere     │                                                     │ │
│ │                             │                                   [ ♥ LOG READING ] │ │
│ └─────────────────────────────┴─────────────────────────────────────────────────────┘ │
│                                                                    [toasts incidentes]│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Móvil (< lg, 1 columna)

```
┌──────────────────────────┐
│ ORBVITAL            [☰]  │
├──────────────────────────┤
│                          │
│ To deep space            │
│ and back, safely.        │
│                          │
│ Crewed spaceflight       │
│ vitals, 5 biomedical…    │
│                          │
│ [ Log Reading → ]        │
│ ( ◎ 3D NRHO ORBIT )      │
│                          │
│ SITE    SHACKLETON·86.8°S│
│ GRAVITY 0.166 g          │
│ ORBIT   NRHO 9:2         │
│ TELEM.  ● 7 VITALS       │
│──────────────────────────│
│ The 5 Hazards of         │
│ Spaceflight              │
│ ( EVALUATE METRICS → )   │
│ ┌──────────────────────┐ │
│ │▌[R] Space Radiation  │ │
│ │ [I] Isolation…       │ │
│ │ [D] Distance…        │ │
│ │ [G] Altered Gravity  │ │
│ │ [H] Hostile Closed…  │ │
│ │──────────────────────│ │
│ │ ☢ Space Radiation    │ │
│ │ summary…             │ │
│ │ ⚠ Impact             │ │
│ │ ✓ Countermeasure     │ │
│ │ Indicator / Nominal /│ │
│ │ Critical (apilados)  │ │
│ │ [ ♥ LOG READING ]    │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

Menú hamburguesa abierto: lista vertical de links con icono + bloque de sesión (`Sign in` / `Register` o nombre + `Sign out`).

## Interacciones

| Elemento | Acción |
| :--- | :--- |
| `Log Reading →` (hero y dossier) | Navega a `/readings/new` |
| `3D NRHO ORBIT` | Navega a `/visualizer` |
| `EVALUATE METRICS →` | Navega a `/readings/new` |
| Ítem del rail `[R] [I] [D] [G] [H]` | `role="tab"`; cambia el dossier de la derecha (animación `materialize`). Por defecto: `[R]`. |

## Contenido del dossier por peligro

| Código | Peligro | Indicador | Nominal | Crítico |
| :-: | :--- | :--- | :--- | :--- |
| R | Space Radiation | Body Temperature & Heart Rate | 36.1 – 37.5 °C | > 38.0 °C o HR > 100 bpm |
| I | Isolation & Confinement | Sleep Duration & Mood | ≥ 7 h · Mood 4–5 | < 6 h o Mood ≤ 2/5 |
| D | Distance from Earth | Blood Glucose & Nutrition | 70 – 140 mg/dL | < 70 o > 180 mg/dL |
| G | Altered Gravity (0.166g) | Blood Pressure & Heart Rate | < 130 / < 85 mmHg | ≥ 140/90 o sistólica < 90 |
| H | Hostile Closed Environments | SpO₂ | ≥ 95 % | < 92 % |

## Estados

- **Sin sesión**: navbar muestra `Sign in` + `Register`.
- **Con sesión**: navbar muestra nombre + rol (`Astronaut` / `Flight Surgeon`) y botón `Sign out`; rol `ADMIN` añade link `Surgeon`.
- Sin estados de carga: el contenido es estático.
