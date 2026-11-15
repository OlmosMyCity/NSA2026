# 04 — My Health · Digital Twin

| | |
| :--- | :--- |
| **Ruta** | `/dashboard` |
| **Archivo** | `apps/frontend/src/app/dashboard/page.tsx` |
| **Componentes** | `AppLayout` → `HealthTabs`, `HealthDashboard` (`Body3D`, `ScenarioDock`, `ZoneSelector`, `ZoneInspector` / `TwinOverview`, grilla de vitales) |
| **Acceso** | Usuario autenticado (astronauta ve su propio gemelo; admin puede cambiar de tripulante) |
| **Objetivo** | Ver el estado fisiológico del tripulante sobre un modelo anatómico 3D de 5 zonas, simular escenarios *What-If* sin gastar tokens y pedir triage IA de forma explícita. |

> **Regla de producto:** el motor de reglas determinista decide el estado oficial; Gemini Decision 1 es solo segunda opinión y se ejecuta únicamente con `Run triage`.

## Desktop (≥ lg · grid `1fr | 340–400px`)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ORBVITAL   Home ▌My Health  Log Reading  Routine  Missions  3D Orbit  Crew  Surgeon  │
│                                                          Jane Doe / Astronaut  [⎋]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ▌Anatomical Body   Historical Trends   Vision AI (Live)      ( 🚀 View my active mission )
│ ─────────────────────────────────────────────────────────────────────────────────────│
│                                                                                      │
│ Digital twin                                     Crew member [ Reid Wiseman ▾ ]      │
│ Reid Wiseman · Last reading Nov 15, 09:42                    ┌ Status ● Nominal ┐    │
│                                                                                      │
│ ┌─ twin-panel (Body3D) ───────────────────────────────┐ ┌─ aside · sticky ─────────┐ │
│ │ (← Full body)                ⟳ Drag to rotate ·     │ │ ZONE SELECTOR (segmented)│ │
│ │                                click an organ       │ │ ●Heart ●Brain ●Blood     │ │
│ │                                                     │ │ ●Bones ●Sleep            │ │
│ │                    ░░░░░                            │ │──────────────────────────│ │
│ │                   ░░░░░░░                           │ │ ── sin zona: OVERVIEW ── │ │
│ │                    ░░░░░        modelo anatómico    │ │ ┌──────────────────────┐ │ │
│ │                 ░░░░░░░░░░░     3D (Three.js)       │ │ │(🛡) Monitor on board │ │ │
│ │                ░░░ ♥ ░░░░░░     zonas coloreadas    │ │ │ Rest & re-measure    │ │ │
│ │                ░░░░░░░░░░░░     por estado          │ │ │ Confidence 82%       │ │ │
│ │                 ░░░░░░░░░░      (verde/ámbar/rojo)  │ │ │ Crew note mood 4/5   │ │ │
│ │                   ░░░░░░        corazón late al HR  │ │ └──────────────────────┘ │ │
│ │                   ░░  ░░                            │ │ Zone            Status   │ │
│ │                   ░░  ░░                            │ │ ● Heart         Stable   │ │
│ │                   ░░  ░░                            │ │ ● Brain & Mood  Watch    │ │
│ │                                                     │ │ ● Blood & Resp. Stable   │ │
│ └─────────────────────────────────────────────────────┘ │ ● Bones & Musc. Elevated │ │
│ ┌─ What-if scenario ─────────── ( ● Showing last reading ) │ ● Sleep        Stable   │ │
│ │                                                     │ │                          │ │
│ │ Heart Rate (resting)   72 bpm │ Environment         │ │ ── con zona: INSPECTOR ──│ │
│ │ |=======o--------------|      │ [ Orion spacecraft ▾ ]│ │ Heart     Zone risk Stable│
│ │ O₂ Saturation (SpO₂)   97 %   │ Solar storm  Shielding│ │ ⚠ Measurement overdue   │ │
│ │ |================o-----|      │ [S0·Quiet▾] [Cabin ▾] │ │ Heart Rate   72 bpm ▲   │ │
│ │ Sleep Duration        7.0 h   │ Crew note (optional)  │ │ Systolic BP 118 mmHg ─  │ │
│ │ |===========o----------|      │ [__________________]  │ │ Diastolic BP 76 mmHg ▼  │ │
│ │                                                     │ │ ▸ Why spaceflight affects│ │
│ │                               ( ↺ Reset ) [ ▶ Run triage ] │   this               │ │
│ └─────────────────────────────────────────────────────┘ │ HRP hazard load          │ │
│                                                         │ Radiation   ▓▓▓░░░       │ │
│                                                         │ Isolation   ▓▓░░░░       │ │
│                                                         │ Distance    ▓▓▓▓░░       │ │
│                                                         │ Gravity     ▓▓▓▓▓░       │ │
│                                                         │ Hostile env ▓▓░░░░       │ │
│                                                         └──────────────────────────┘ │
│                                                                                      │
│ All vitals                                                                           │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐   │
│ │● Heart │● Systol│● Diast.│● Blood │● Body  │● O₂ Sat│● Sleep │● Mood  │● Resist│   │
│ │ Rate   │ BP     │ BP     │ Glucose│ Temp   │ (SpO₂) │ Durat. │        │ Exerc. │   │
│ │ 72 bpm │118 mmHg│ 76 mmHg│ 95mg/dL│36.8 °C │ 97 %   │ 7.0 h  │ 4 /5   │ 45 min │   │
│ └────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘   │
│                                       Anatomy model: BodyParts3D © DBCLS, CC BY 4.0  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Móvil (< lg · 1 columna)

```
┌──────────────────────────┐
│ ORBVITAL            [☰]  │
├──────────────────────────┤
│▌Anatomical Body          │
│ Historical Trends        │
│ Vision AI (Live)         │
│ ( 🚀 View my active… )   │
│──────────────────────────│
│ Digital twin             │
│ Reid W. · Last reading…  │
│ Crew member [ Reid ▾ ]   │
│ [ Status ● Nominal ]     │
│ ┌──────────────────────┐ │
│ │ ⟳ Drag to rotate     │ │
│ │        ░░░           │ │
│ │       ░░♥░░  Body3D  │ │
│ │        ░░░           │ │
│ │        ░ ░           │ │
│ └──────────────────────┘ │
│ ┌ What-if scenario ────┐ │
│ │ HR      |====o---|   │ │
│ │ SpO₂    |======o-|   │ │
│ │ Sleep   |===o----|   │ │
│ │ Environment [ ▾ ]    │ │
│ │ Storm [▾] Shield [▾] │ │
│ │ Crew note [_______]  │ │
│ │ (↺ Reset)[▶ Run triage]│
│ └──────────────────────┘ │
│ ┌ Inspector ───────────┐ │
│ │ Heart Brain Blood …  │ │
│ │ Verdict / Zones o    │ │
│ │ detalle de zona      │ │
│ └──────────────────────┘ │
│ All vitals (2 columnas)  │
│ ┌─────────┬─────────┐    │
│ │ HR 72   │ SBP 118 │    │
│ │ DBP 76  │ Glu 95  │    │
│ │ …       │ …       │    │
│ └─────────┴─────────┘    │
└──────────────────────────┘
```

La grilla *All vitals* usa 2 columnas en móvil, 3 en `sm` y 9 en `lg`.

## Zonas del gemelo y vitales asociados

| Zona (`BODY_ZONES`) | Vitales |
| :--- | :--- |
| Heart | Heart Rate (resting), Systolic BP, Diastolic BP |
| Brain & Mood | Mood |
| Blood & Respiration | Blood Glucose, Body Temperature, O₂ Saturation (SpO₂) |
| Bones & Muscles | Resistance Exercise |
| Sleep | Sleep Duration |

Niveles de riesgo por zona (`RISK_META`): **Stable** · **Watch** · **Elevated** · **Critical**.
Estados de vitales (`STATUS_THEME`): **Nominal** (verde) · **Watch** (ámbar) · **Critical — notify flight surgeon** (rojo).

## What-if scenario (`ScenarioDock`)

| Control | Rango / opciones |
| :--- | :--- |
| Heart Rate slider | 35 – 150 bpm (marca la línea base de la última lectura) |
| SpO₂ slider | 80 – 100 % |
| Sleep slider | 0 – 12 h |
| Environment | Orion spacecraft · Space station · Lunar base · Pressurized rover · Mars base |
| Solar storm (NOAA) | S0 Quiet sun · S1 Minor · S2 Moderate · S3 Strong · S4 Severe · S5 Extreme |
| Shielding | EVA suit 1.2 g/cm² · Crew cabin 10 g/cm² · Storm shelter 25 g/cm² |
| Crew note (optional) | Texto libre → estimación de ánimo por el modelo |
| `Reset` / `Run triage` | Restaura la línea base / ejecuta Gemini Decision 1 (única acción que gasta tokens) |

Pill de estado: `Showing last reading` (verde) → `Simulating` (ámbar) en cuanto se mueve cualquier control.

## Estados de la vista

| Estado | UI |
| :--- | :--- |
| Cargando | Skeletons: visor 560 px + dock 224 px a la izquierda, panel 640 px a la derecha |
| Error | Panel centrado: ⚠ + mensaje + `( ⟳ Retry )` |
| Sin lecturas | `EmptyState` "No readings recorded yet — Log vitals or load a simulated baseline." + `[ Log reading ]` + `( ⚗ Explore with a simulated baseline )` |
| Con lecturas | Layout completo; header muestra `Status` oficial (reglas) |
| Simulando | Header muestra `Simulated status`; resultados de triage previos se atenúan (`isStale`) hasta volver a correr triage |
| Triage en curso | Verdict con `animate-pulse` / opacidad reducida |
| Veredicto | `Monitor on board` (verde, 🛡) o `Escalate to flight surgeon` (rojo, 📞) + acción + confianza % |

## Interacciones

| Elemento | Acción |
| :--- | :--- |
| Tabs | `/dashboard` · `/trends` · `/vision` |
| `View my active mission` | `/missions/{missionId}` (misión del astronauta o la `IN_PROGRESS`) |
| Crew member select | Visible si hay > 1 tripulante; cambia el gemelo mostrado |
| Click en órgano (3D) / Zone selector / fila de Zones / celda de vitales | Selecciona la zona → aside muestra `ZoneInspector` y el visor hace foco |
| Hover sobre órgano | Chip superior derecho muestra ● + nombre de la zona |
| `← Full body` | Deselecciona la zona → vuelve a `TwinOverview` |
