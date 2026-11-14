# Plan de Implementación: Módulo de Predicción y Alerta Temprana de Radiación Espacial (Deep Space Radiation Engine)
**Ubicación:** `NSA2026/docs/SPACE_RADIATION_MODULE_PLAN.md`

## Resumen del Enfoque Técnico
Para garantizar máxima robustez científica y un desarrollo ágil en hackathon sin perder tiempo entrenando redes neuronales pesadas desde cero, este módulo implementa una arquitectura híbrida de **Consumo de Modelos Operacionales Oficiales (NOAA SWPC / NASA WSA-ENLIL)** + **Inferencia Cinemática y Relativista en Tiempo Real (GOES X-ray Nowcasting & Parker Spiral Transit)**.

El módulo residirá en `NSA2026/radiation-engine` y se expondrá como una librería modular y un micro-servicio REST con fallback offline y simulador interactivo para la demo a los jueces.

---

## Fases Detalladas de Implementación

### Fase 1: Entorno, Modelos Operacionales y Clientes de Datos Oficiales (NASA & NOAA)
**Objetivo:** Obtener las salidas ya calculadas por las supercomputadoras de NASA y NOAA, junto con telemetría en tiempo real de satélites GOES y datasets históricos reales de respaldo.

* **1.1 Configuración del entorno del módulo (`NSA2026/radiation-engine`):**
  * Inicializar proyecto TypeScript/Node.js con configuración estricta, scripts de build y tests con Jest/Vitest.
* **1.2 Ingestor del Modelo Operacional de Probabilidad Solar NOAA SWPC:**
  * Consumir `https://services.swpc.noaa.gov/json/solar_probabilities.json`.
  * Extraer probabilidades a 1, 2 y 3 días de:
    * Fulguraciones Clase C, M y X.
    * Eventos de protones energéticos >10 MeV (SPE).
    * Estado de polar cap absorption.
* **1.3 Ingestor de Telemetría en Tiempo Real Satelital GOES:**
  * Consumir flujos a 1 minuto: `https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json` y `differential-protons-6-hour.json`.
  * Detección de clase en curso mediante flujo 0.1-0.8 nm ($10^{-8} = B$, $10^{-6} = C$, $10^{-5} = M$, $\ge 10^{-4} = X$).
* **1.4 Conector NASA DONKI (WSA-ENLIL Solar Wind Model):**
  * Consumir endpoints de `CMEAnalysis` para obtener predicción de choque de masa coronal (velocidad de plasma en km/s y hora estimada de impacto $T_{shock}$).
* **1.5 Cache y Datasets Históricos Offline:**
  * Guardar réplicas estáticas de eventos históricos (Mayo 2024 Tormenta Solar G5/S3 y Halloween 2003) para operar en modo offline sin depender de la conectividad en la presentación.

---

### Fase 2: Motor Físico de Tránsito Relativista y Ventana de Alerta Temprana
**Objetivo:** Calcular la ventana de tiempo exacta entre la detección de rayos X y el arribo de las partículas energéticas a la órbita de la Luna/espacio profundo.

* **2.1 Algoritmo de Nowcasting por Derivada de Flujo ($dF/dt$):**
  * Analizar la ventana móvil de los últimos 5-15 minutos de rayos X de GOES.
  * Si la derivada supera el umbral crítico ($\ge M5$ con subida empinada), disparar el evento de *Early Warning*.
* **2.2 Motor de Cinemática Relativista de Partículas Solares (SPE Arrival Model):**
  * Ecuación relativista para energías de protones $E \in [10, 100, 500]\text{ MeV}$:
    $$v(E) = c \sqrt{1 - \left(\frac{m_p c^2}{E + m_p c^2}\right)^2}$$
  * Modelado de longitud de línea de campo magnético interplanetario vía Espiral de Parker ($L \approx 1.15-1.25\text{ AU}$):
    $$\Delta t = \frac{L}{v(E)} - \frac{1\text{ AU}}{c}$$
  * Genera el valor clave: **Ventana de Tiempo Útil (ETA to Peak Impact)** (típicamente entre 30 y 90 minutos para protones de 50-100 MeV).

---

### Fase 3: Calculadora de Dosis Biológica y Atenuación por Blindaje (NASA HRP)
**Objetivo:** Convertir el flujo físico de radiación en dosis absorbida en tejido humano ($\mu\text{Sv/h}$ y $\text{mSv}$) según el hábitat del astronauta.

* **3.1 Modelo de Coeficientes de Atenuación por Blindaje:**
  * Factores basados en masa superficial ($g/cm^2$):
    * `EVA_SUIT`: Blindaje mínimo ($1.2\text{ g/cm}^2$) $\rightarrow$ Exposición casi directa a protones solares.
    * `CREW_CABIN_NOMINAL`: Blindaje estándar módulo Orión / Hábitat lunar ($10\text{ g/cm}^2$).
    * `STORM_SHELTER`: Búnker de supervivencia rodeado de tanques de agua, alimentos y polietileno ($25\text{ g/cm}^2$).
* **3.2 Cálculo de Tasa de Dosis y Acumulada:**
  * Conversión de $\text{pfu}$ (particle flux units) a microSieverts por hora ($\mu\text{Sv/h}$).
  * Contraste con los límites del estándar de la NASA **NASA-STD-3001**:
    * Límite de 30 días: $250\text{ mSv}$.
    * Límite anual de carrera: $500\text{ mSv}$.
    * Umbral agudo de síntomas (náusea, eritema): $>500\text{ mSv}$.

---

### Fase 4: Clasificación Oficial NOAA (S1–S5) y Protocolos de Mitigación
**Objetivo:** Generar salidas accionables inmediatas para la tripulación.

* **4.1 Evaluador de Escala NOAA Solar Radiation Storm:**
  * `S0_NOMINAL`: $<10\text{ pfu}$.
  * `S1_MINOR`: $\ge 10\text{ pfu}$ (Monitoreo reforzado).
  * `S2_MODERATE`: $\ge 100\text{ pfu}$ (Peligro biológico leve; restringir EVA).
  * `S3_STRONG`: $\ge 1,000\text{ pfu}$ (Abortar inmediatamente paseos espaciales; radioprotectores).
  * `S4_SEVERE`: $\ge 10,000\text{ pfu}$ (Evacuación inmediata al *Storm Shelter*).
  * `S5_EXTREME`: $\ge 100,000\text{ pfu}$ (Peligro letal; supervivencia en refugio durante 24-48h).
* **4.2 Generador de Protocolos de Acción:**
  * Lista estructurada de directivas para la UI:
    * `EVACUATE_TO_SHELTER: true/false`
    * `ABORT_EVA: true/false`
    * `RECOMMENDED_MEDICAL_ACTION`: p. ej., *"Administrar antieméticos profilácticos y antioxidantes radioprotectores"*.

---

### Fase 5: Simulador Interactivo y API REST para Integración del Equipo
**Objetivo:** Permitir que el equipo consuma los datos fácilmente y que los jueces experimenten la alerta en vivo.

* **5.1 Controlador de Escenarios de Simulación:**
  * Escenario 1: `NOMINAL` (Condiciones tranquilas en espacio interplanetario).
  * Escenario 2: `SOLAR_FLARE_IN_PROGRESS` (Fulguración X3.2 detectada; cuenta regresiva de 48 minutos de alerta temprana).
  * Escenario 3: `PEAK_PROTON_STORM` (Tormenta S4 en curso; muestra la reducción drástica de dosis al alternar entre "Exterior EVA" y "Storm Shelter").
* **5.2 Endpoints REST y SDK TypeScript:**
  * `GET /api/radiation/status`: Estado actual en vivo de NOAA/NASA.
  * `GET /api/radiation/forecast`: Probabilidades a 3 días y predicción de impacto CME.
  * `POST /api/radiation/simulate`: Dispara un escenario para pruebas del frontend.
* **5.3 Documentación de Integración para el Frontend:**
  * Guía rápida en `docs/` con ejemplos de llamadas y tipos TypeScript listos para copiar y pegar.

---

## Verificación del Módulo
* **Pruebas unitarias:**
  * Verificar que la cinemática relativista calcule tiempos de viaje entre 35 y 90 min para energías de 50-100 MeV.
  * Verificar que la atenuación del *Storm Shelter* reduzca la dosis en al menos 85-95% respecto a un traje EVA.
  * Verificar que el ingestor consuma correctamente `solar_probabilities.json` de NOAA.
