# NASA Space Apps Challenge 2026 — Health Monitoring Software for Astronauts

> Contexto oficial del reto (copiado textual) + cómo lo aborda **Artemis IV Crew Health**.
> Este archivo es idéntico en `artemis-iv-backend` y `artemis-iv-frontend`.

---

## 1. El reto (texto oficial)

**Create Health Monitoring Software for Astronauts on Space Missions**

- **Event:** 2026 NASA Space Apps Challenge
- **Difficulty:** Intermediate
- **Subjects:** Human Exploration · Software · Space Exploration

Long-duration missions expose astronauts to space radiation, isolation and confinement, altered gravity, and a hostile closed environment, which can bring immune changes, bone loss, cardiovascular events, and behavioral health problems. On long missions, astronauts carry much of the responsibility for spotting these changes in themselves. Your challenge is to build a health monitoring software that gathers health indicators and enables astronauts to evaluate and act on the status of their health.

### Background

With rising investment in spacecraft technology and research, space missions have become more ambitious. NASA's Artemis program recently accomplished a crewed lunar flyby, and NASA and others have plans to send humans to Mars in the future. With increasingly longer missions, astronauts will be more exposed to the hostile space environment, which brings both physical and mental health risks.

NASA's Human Research Program has mapped the five hazards of human spaceflight, which are space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments. These hazards can contribute to health problems such as immune system changes, bone density loss, cardiovascular events, inadequate nutrition, behavioral health conditions, and others. Astronauts must be capable of making health assessments on themselves during a mission, to prevent and treat health problems that may arise. Some useful health indicators are blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, and mood.

### Objectives

Your challenge is to create a visual tool that helps astronauts assess their own health during space missions and provides guidance on treatments and health improvements. You may consider gathering data from the user through any kind of input—keyboard text, mouse clicks, or camera images, for example. Any kind of data can be used, as long as it represents a health indicator, such as blood sugar levels in mg/dL or ultrasound images.

You can use NASA's Human Research Program resources, along with the publicly available resources from other space agencies, to understand how spaceflight hazards affect human health, and to decide which indicators are useful and how they can support a quick assessment. Which measurements can be performed in space? Why is an exam needed? How do spaceflight hazards affect these health indicators? When might a result warrant attention from the crew or from flight surgeons on the ground? What actions can be taken to prevent a critical health condition? These are questions worth considering as you develop your solution.

User interface design plays an important role in presenting metrics and diagnosis clearly. You may consider taking advantage of animations and interactivity to present the information. For example, the software could display a human figure where each part of the body is clickable and displays information about its function and health status.

### Potential Considerations

You may (but are not required to) consider the following:

- Your tool could provide health insights for astronauts in different environments, such as a spacecraft, a space station, a rover, or a base on another planet or moon.
- Your tool could prompt astronauts to take measurements or complete specific actions from time to time as a part of the mission routine.
- Your tool could include the following features:
  - A gamification system to help astronauts engage with tasks that support their health
  - Dynamic charts that show how astronaut's health indicators change over time
  - Color coding that helps the astronaut interpret the status of a health indicator at a glance
- Do not assume that astronauts know everything about how to assess their health. Your tool could provide simple instructions and explanations covering measurements, health indicators, and risks.

For data and resources related to this challenge, refer to the Resources tab of the challenge page.

---

## 2. Cómo lo abordamos

**Plazo:** 2 días. **Estrategia:** cumplir los requisitos del proyecto web del curso (API REST + frontend Next.js) cambiando el dominio de "planificación de misiones" a **salud de la tripulación**, y reutilizar el simulador/visor 3D de `ArtemisIV-flight-dynamics` como contexto de la misión.

### Indicadores del MVP

| Indicador | Unidad | Verde | Ámbar | Rojo (avisar a cirujano de vuelo) | Riesgo espacial (NASA HRP) |
|---|---|---|---|---|---|
| Frecuencia cardiaca (reposo) | lpm | 50–90 | 91–100 / 40–49 | >100 / <40 | Cardiovascular, gravedad alterada |
| Presión arterial sistólica / diastólica | mmHg | <130 / <85 | 130–139 / 85–89 | ≥140 / ≥90 o <90 sist. | Redistribución de fluidos |
| Glucosa en sangre | mg/dL | 70–140 | 141–180 | <70 / >180 | Nutrición inadecuada |
| Temperatura corporal | °C | 36,1–37,5 | 37,6–38,0 | >38,0 / <35,5 | Sistema inmune, radiación |
| Saturación de O₂ (SpO₂) | % | ≥95 | 92–94 | <92 | Ambiente cerrado hostil |
| Horas de sueño | h/día | ≥7 | 6–6,9 | <6 | Aislamiento, ritmo circadiano |
| Ánimo | escala 1–5 | 4–5 | 3 | 1–2 | Salud conductual, aislamiento |

> Umbrales orientativos para la demo, no criterio clínico.

### Mapeo reto → funcionalidades

| Pide el reto | Lo cubrimos con |
|---|---|
| Recoger indicadores | Formulario "Registrar medición" con instrucciones de cómo medir cada indicador |
| Evaluar y actuar | Evaluación automática por umbrales → estado + alertas + recomendación |
| Figura humana clicable | Dashboard con figura SVG: corazón, cerebro/ánimo, sangre/glucosa, huesos, sueño |
| Código de colores | Verde / ámbar / rojo en figura, tarjetas y gráficas |
| Gráficas dinámicas | Tendencias por indicador con bandas de color |
| Recordatorios en la rutina | Checklist diario de mediciones |
| Gamificación | Racha de días completos e insignias simples |
| Distintos entornos | `Mission.environment`: nave, estación, rover, base lunar/marciana |
| Explicaciones para no expertos | Fichas por indicador: qué es, por qué cambia en el espacio, qué hacer |

### Referencias
- NASA Human Research Program — The Human Body in Space / 5 Hazards of Human Spaceflight: <https://www.nasa.gov/hrp/hazards>
- Página del reto en spaceappschallenge.org (pestaña *Resources*).
