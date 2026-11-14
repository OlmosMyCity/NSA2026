# Guía de Integración: Deep Space Radiation Engine (NSA2026)

Este documento explica cómo integrar el **Módulo de Predicción y Alerta Temprana de Radiación Espacial** con el frontend y backend de su equipo.

---

## 1. ¿Cómo funciona el módulo?
El módulo se encuentra en `NSA2026/radiation-engine`. Puede ser consumido de dos formas:
1. **Como Servicio REST (Microservicio):** Ejecutándolo con `npm run start` o `npm run dev` en el puerto `4000` (o el que configure en `.env`).
2. **Como Librería / SDK TypeScript Directo:** Importando `RadiationEngine` directamente en el backend de su aplicación Node.js.

---

## 2. Endpoints del Microservicio REST

Base URL por defecto: `http://localhost:4000`

### A. Obtener Estado en Tiempo Real / Alerta Actual
`GET /api/radiation/status`

**Respuesta JSON de ejemplo:**
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
      "doseRateMicroSvPerHour": 34439.3,
      "projected30DayDoseMsv": 826.54,
      "careerDosePercentage": 165.3,
      "clinicalRiskLevel": "HAZARDOUS"
    },
    "CREW_CABIN_NOMINAL": {
      "doseRateMicroSvPerHour": 9064.3,
      "projected30DayDoseMsv": 217.54,
      "careerDosePercentage": 43.5,
      "clinicalRiskLevel": "ELEVATED"
    },
    "STORM_SHELTER": {
      "doseRateMicroSvPerHour": 1451.8,
      "projected30DayDoseMsv": 34.84,
      "careerDosePercentage": 6.9,
      "clinicalRiskLevel": "NOMINAL"
    }
  },
  "mitigation": {
    "stormScale": "S4_SEVERE",
    "abortEvaImmediately": true,
    "evacuateToStormShelter": true,
    "powerDownExternalSensors": true,
    "medicalCountermeasures": [
      "Administer prophylactic antiemetic to prevent acute motion/radiation sickness",
      "Oral radioprotector supplement regimen (Vitamins C, E, Selenium, N-acetylcysteine)",
      "Prepare peripheral blood sample kit for post-event lymphocyte count"
    ],
    "actionChecklist": [
      "Abort all EVA operations; repressurize airlock on rapid cycle",
      "Crew ingress to dedicated Storm Shelter within 20 minutes"
    ]
  }
}
```

---

### B. Disparador de Simulación para la Presentación a los Jurados
`POST /api/radiation/simulate`

**Cuerpo de la petición (JSON):**
```json
{
  "scenario": "FLARE_EARLY_WARNING"
}
```

Valores permitidos para `scenario`:
* `"FLARE_EARLY_WARNING"`: Simula una fulguración solar X4.5 y activa la cuenta regresiva de 48 minutos de alerta temprana antes de que lleguen los protones.
* `"PEAK_STORM_S4"`: Simula el impacto del pico de protones de alta energía (14,500 pfu, Tormenta S4). Muestra la enorme diferencia de dosis biológica entre estar en EVA suit vs. estar en el Storm Shelter.
* `"NOMINAL"`: Simula radiación de fondo tranquila.
* `"RESET"`: Regresa a la telemetría en vivo de los satélites NOAA GOES y NASA DONKI.

---

## 3. Uso como SDK TypeScript directo en su Backend

Si prefieren importar el código directamente en su servidor sin levantar un microservicio adicional:

```typescript
import { RadiationEngine } from './radiation-engine/src';

const radiationEngine = new RadiationEngine();

// Obtener estado actual
const state = await radiationEngine.getCurrentState();

// Activar escenario para demo
radiationEngine.setSimulationScenario('FLARE_EARLY_WARNING');
```

---

## 4. Ideas de Visualización para el Frontend (UI)

1. **Banner de Alerta Temprana en el Header:**
   * Si `earlyWarning.isWarningActive === true`: mostrar banner naranja/rojo parpadeante:
   * *"⚠️ SOLAR PARTICLE EVENT IMMINENT — ETA to Peak Flux: XX min — ACTION: Proceed to Crew Storm Shelter"*.
2. **Selector de Escenarios de Demo:**
   * Un dropdown discreto o botones para que el presentador pueda alternar entre `Nominal`, `Solar Flare Warning` y `Peak Storm S4` durante el video o la presentación con jueces.
3. **Tarjeta de Dosis por Blindaje:**
   * Mostrar una comparativa visual de barras o medidores de aguja con los 3 valores:
     - Traje EVA: Rojo / Peligro
     - Cabina Estándar: Ámbar / Elevado
     - Storm Shelter: Verde / Protegido (reducción del 95.8% de radiación)
