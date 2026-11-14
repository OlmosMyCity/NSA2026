# OrbVital — Monitoreo Biométrico y Psicológico de Astronautas (`astronaut_vitals`)

Subsistema ligero y **100% open-source** optimizado para **CPU** que detecta indicadores críticos de salud de los astronautas sin contacto invasivo:

1. **Estado de Ánimo y Estrés Psicológico (`Mood & Stress`)**:
   - Inferencia neuronal ligera con **ONNX Runtime** (`emotion-ferplus-8.onnx`) fusionada con **Action Units geométricas** (contracción de cejas/entrecejo, comisuras labiales, apertura ocular) sobre 478 puntos 3D de **MediaPipe Face Landmarker**.
   - Entrega: Estado operativo dominante (`Calm / Focused`, `Positive / Engaged`, `Stressed / High Tension`, `Fatigued / Drowsy`), Índice de Estrés (`0–100%`), Valencia Emocional (`-1.0` a `+1.0`) y Alerta Cognitiva (`0–100%`).

2. **Calidad de Sueño, Somnolencia y Actigrafía (`Sleep & Fatigue`)**:
   - **Modo Vigilia en Cabina (`cabin_active`)**: Calcula **EAR** (*Eye Aspect Ratio*), **PERCLOS** (porcentaje de cierre palpebral en ventana móvil, estándar de la NASA), **MAR** (*Mouth Aspect Ratio* para conteo de bostezos), detección de **microsueños** ($\ge 1.5\text{ s}$) y cabeceo por ángulos 3D de cabeza (*Pitch / Yaw / Roll*).
   - **Modo Módulo de Sueño (`sleep_pod`)**: **Actigrafía por video** (energía de movimiento inter-cuadro) que clasifica fases de descanso (`Deep Rest`, `Light/Restless Sleep`, `Awake`) y calcula un **Sleep Quality Score (`0–100`)**.

3. **Pulsaciones por Minuto y Variabilidad Cardíaca (`BPM & HRV` Multicámara)**:
   - Fotopletismografía remota (**rPPG**) sin contacto sobre polígonos faciales de **frente (glabela)** y **mejillas**:
     - **Cámara RGB Estándar**: Algoritmos **POS** (*Plane-Orthogonal-to-Skin*, Wang et al.) y **CHROM** (*Chrominance*, De Haan & Jeanne).
     - **Cámara Infrarroja / NIR / Nocturna**: Algoritmo **Single-Channel Spatial-Temporal NIR-rPPG** con eliminación de tendencia (*detrending*), filtro pasa-banda Butterworth (`0.75–3.0 Hz` $\equiv$ `45–180 BPM`), periodograma espectral de Welch con interpolación parabólica, cálculo de **HRV (`RMSSD` y `SDNN` en ms)**, frecuencia respiratoria (**RPM**) e Índice de Calidad de Señal (**SQI**).

---

## Instalación y Ejecución Rápida

```bash
cd astronaut_vitals

# 1. Crear entorno virtual (Python 3.11) e instalar dependencias
/usr/bin/python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Descargar modelos ligeros open-source (ONNX FERPlus + MediaPipe FaceLandmarker)
.venv/bin/python download_models.py

# 3. Ejecutar el servidor FastAPI + Dashboard de Control de Misión
.venv/bin/python run.py --port 8000
```

Luego abre **`http://localhost:8000`** en tu navegador.

---

## Pruebas Automatizadas

```bash
cd astronaut_vitals
.venv/bin/pytest -v
```
