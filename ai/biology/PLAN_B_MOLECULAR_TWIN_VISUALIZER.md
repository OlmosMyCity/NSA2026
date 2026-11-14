# Plan B: Gemelo Molecular Pre-calculado en A100 + Visor Interactivo de Daño y Contramedidas

**Objetivo:** Potenciar la figura humana interactiva del reto (`/visualizer` en `artemis-iv-frontend`) conectando la dosis biológica de `NSA2026/radiation-engine` con **evidencia biofísica real pre-calculada en GPU A100** (docking molecular + cinética de reparación de ADN por EDOs), explicando al astronauta *por qué* ocurren los riesgos y *cómo* actúan las contramedidas recomendadas.

---

## Arquitectura del Módulo (`biology/molecular_twin`)

### 1. Simulación Biofísica Corta en GPU A100 (Offline, 4–6 horas)
En lugar de ejecutar simulaciones pesadas en vivo durante la demo, se corren experimentos acotados en la A100 y se exportan resultados listos para consumir:
* **Experimento 1 — Docking Molecular (AutoDock Vina / Smina / DiffDock):**
  * **Complejo de reparación:** Proteína sensora **Ku70/Ku80** (ej. PDB `1JEY`) acoplada frente a ADN con daño simple vs. daño agrupado (*clustered lesion* / 8-oxoG) para ilustrar pérdida de eficiencia en reparación NHEJ.
  * **Contramedidas radioprotectoras:** Acoplamiento de antioxidantes recomendados por `radiation-engine` (**N-acetilcisteína, Vitamina C/E**) sobre blancos de respuesta oxidativa (ej. Keap1/Nrf2).
  * **Outputs:** Estructuras 3D limpias (`.pdb` / `.sdf`), energías de afinidad ($\Delta G$ en kcal/mol) y residuos clave de interacción.
* **Experimento 2 — Cinética de Biomarcadores (EDOs en Python/SciPy):**
  * Resolver la EDO no lineal de **$\gamma$-H2AX (Michaelis-Menten)** para modelar saturación de reparación celular:
    $$\frac{dD(t)}{dt} = \alpha \dot{R}(t) - \frac{V_{max} D(t)}{K_m + D(t)}$$
  * Resolver el sistema compartimental **Tejido $\rightarrow$ Sangre $\rightarrow$ Orina (8-OHdG)** para predecir la ventana óptima de toma de muestra urinaria tras una tormenta solar.
  * **Outputs:** Curvas temporales en JSON para los escenarios `NOMINAL`, `FLARE_EARLY_WARNING` y `PEAK_STORM_S4`, comparando `EVA_SUIT` vs. `CREW_CABIN_NOMINAL` vs. `STORM_SHELTER`.

### 2. Backend / Catálogo Biofísico
* Endpoint `GET /api/biophysics/scenarios/:scenario` que devuelve:
  * Curvas temporales de $\gamma$-H2AX y 8-OHdG según blindaje.
  * Metadatos de docking ($\Delta G$, residuos clave, explicación clínica).
  * Rutas a los archivos `.pdb` estáticos para renderizado 3D.

### 3. Integración Frontend (`artemis-iv-frontend/src/app/visualizer/page.tsx`)
* Al seleccionar sistemas en la figura humana (ej. **Médula Ósea / Sistema Inmune**, **Sistema Renal/Urinario**):
  * **Visor 3D ligero en navegador** (`3Dmol.js` o `Mol*`) mostrando el complejo Ku70/Ku80–ADN o el radioprotector calculado en la A100.
  * **Gráfica dinámica** de reparación de ADN ($\gamma$-H2AX) y ventana recomendada para el test de orina (8-OHdG) al alternar entre `EVA_SUIT` y `STORM_SHELTER`.
  * Tarjeta explicativa en lenguaje simple para el astronauta conectada a `medicalCountermeasures` de `radiation-engine`.

---

## Cronograma de Ejecución (2 Días)

| Bloque | Tareas | Entregables |
| :--- | :--- | :--- |
| **Día 1 - Mañana** | Descargar PDBs reales (`1JEY`, Keap1), preparar ligandos y ejecutar dockings en GPU A100. | Archivos `.pdb` / `.sdf` + tabla de afinidades ($\Delta G$) |
| **Día 1 - Tarde** | Resolver EDOs de cinética ($\gamma$-H2AX y 8-OHdG) en `SciPy` para los escenarios de `radiation-engine` y empaquetar JSONs. | `biology/molecular_twin/kinetics_ode.py`, JSONs de curvas |
| **Día 2 - Mañana** | Integrar visor 3D (`3Dmol.js`) y gráficas de cinética en `/visualizer`. | Componente 3D + gráficas dinámicas |
| **Día 2 - Tarde** | Conectar con `radiation-engine` (`EVA_SUIT` vs `STORM_SHELTER`) y pulir narrativa visual para la demo. | Demo interactiva en `/visualizer` |
