# Plan A: Motor de "Señal vs. Ruido" (Sensor Fusion: Radiación vs. Microgravedad y Estrés)

**Objetivo:** Implementar un módulo de biodosimetría predictiva y fusión de sensores que permita distinguir si una alteración en los biomarcadores y signos vitales de un astronauta se debe a **exposición a radiación ionizante (HZE / tormentas solares)** o a **ruido fisiológico (microgravedad, privación de sueño, ejercicio intenso o estrés psicológico)**.

Este módulo se integra directamente con:
- **Física / Radiación:** `NSA2026/radiation-engine` (`doseRateMicroSvPerHour`, `stormScale`, `earlyWarning`, `biologicalDoses`).
- **Salud / Signos Vitales:** `HealthReading` en `artemis-iv-backend` / `NSA2026/backend` (`heartRateBpm`, `systolicMmHg`, `diastolicMmHg`, `glucoseMgDl`, `temperatureC`, `spo2Pct`, `sleepHours`, `mood`).
- **Frontend:** `artemis-iv-frontend` (`/dashboard`, `/routine`, `/trends`).

---

## Arquitectura del Módulo (`biology/signal_noise_engine`)

### 1. Entrenamiento y Calibración (Offline / GPU A100)
* **Variables de entrada (Features):**
  * **Telemetría física (`radiation-engine`):** `doseRateMicroSvPerHour`, `stormScaleLevel` (0–5), `shieldingType` (`EVA_SUIT`, `CREW_CABIN_NOMINAL`, `STORM_SHELTER`).
  * **Signos vitales (`HealthReading`):** `heartRateBpm`, `systolicMmHg`, `diastolicMmHg`, `glucoseMgDl`, `temperatureC`, `spo2Pct`, `sleepHours`, `mood`.
  * **Biomarcadores moleculares (ensayos in situ):**
    * `gammaH2axFociPerCell` (roturas de doble cadena en linfocitos; pico 1–2 h).
    * `urine8OhdgNgMg` (estrés oxidativo sistémico en orina; 8-OHdG / creatinina).
    * `fdxrFoldChange` (respuesta transcripcional p53).
* **Modelo:**
  * Clasificador multi-clase / multi-etiqueta (`RandomForestClassifier` / `GradientBoosting` o MLP en PyTorch/scikit-learn) entrenado sobre datos calibrados con rangos fisiológicos y literatura de NASA HRP / GeneLab.
  * **Salidas:**
    * `attribution`: Porcentaje de contribución causal (`ionizingRadiationPct`, `microgravityFluidShiftPct`, `sleepPsychStressPct`).
    * `primaryCause`: Causa dominante (`IONIZING_RADIATION`, `MICROGRAVITY_STRESS`, `SLEEP_PSYCH_STRESS`, `NOMINAL`).
    * `falsePositiveFiltered`: `true` si había biomarcadores elevados (ej. `8-OHdG`) pero el origen no es radiación ionizante.
    * `confidence`: Score de confianza del modelo.
    * `clinicalGuidance`: Recomendación accionable diferenciada para el astronauta.

### 2. Microservicio de Inferencia (`FastAPI`)
* Expone `POST /api/biodosimetry/attribution` (respuesta `< 20 ms`).
* Carga el modelo entrenado (`.joblib` / `.onnx`) y un escalador de características.
* Incluye endpoint `GET /api/biodosimetry/health` para monitoreo.

### 3. Integración Backend (`NSA2026/backend` / `artemis-iv-backend`)
* Endpoint puente `POST /api/health-readings/biodosimetry-triage` que:
  1. Obtiene la última lectura `HealthReading` del astronauta.
  2. Consulta `GET /api/radiation/status` de `NSA2026/radiation-engine`.
  3. Envía el payload fusionado al microservicio FastAPI y retorna el diagnóstico diferencial completo.

### 4. Integración Frontend (`artemis-iv-frontend`)
* Panel **"Signal vs. Noise Attribution"** en `/dashboard` y `/routine`:
  * Barras de atribución porcentual por peligro espacial (Radiación vs. Microgravedad vs. Sueño/Estrés).
  * Indicador visual de **Falsa Alarma Filtrada** vs. **Alerta Genotóxica Real**.
  * Controles de simulación para probar escenarios (ej. privación de sueño en día `NOMINAL` vs. `EVA_SUIT` en `PEAK_STORM_S4`).

---

## Cronograma de Ejecución (2 Días)

| Bloque | Tareas | Entregables |
| :--- | :--- | :--- |
| **Día 1 - Mañana** | Definir rangos biofísicos/fisiológicos, generar dataset de entrenamiento calibrado, entrenar y validar modelo (matriz de confusión + métricas) en Python/A100. | `biology/signal_noise_engine/train_model.py`, artefactos `.joblib` |
| **Día 1 - Tarde** | Construir microservicio FastAPI + esquema Pydantic + pruebas unitarias con escenarios `NOMINAL`, `FLARE_EARLY_WARNING` y `PEAK_STORM_S4`. | `biology/signal_noise_engine/app.py`, tests `pytest` |
| **Día 2 - Mañana** | Conectar endpoint en backend TypeScript integrando `HealthReading` + `radiation-engine`. | Servicio/controlador en backend |
| **Día 2 - Tarde** | Crear componente UI en `artemis-iv-frontend` y validar flujo completo de demo para los jueces. | Componente React + demo end-to-end |
