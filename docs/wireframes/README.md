# Wireframes — Orbvital

Wireframes de baja fidelidad (ASCII) de cada vista del frontend (`frontend/src/app`).
Cada archivo documenta: ruta, propósito, layout desktop y móvil, componentes, estados e interacciones.

> El texto de la interfaz se mantiene en inglés (igual que en la app). Las notas están en español.

## Convenciones

| Símbolo | Significado |
| :--- | :--- |
| `[ Botón ]` | Botón / acción primaria |
| `( Botón )` | Botón secundario / pill |
| `[________]` | Campo de texto |
| `[ Opción ▾ ]` | Select / dropdown |
| `●` / `○` | Indicador de estado / opción no seleccionada |
| `|====o----|` | Slider |
| `░░░` | Imagen / área 3D / gráfico |
| `▌` | Tab o ítem activo |

## Elementos globales (todas las vistas)

- **Navbar** (`features/common/components/Navbar.tsx`): sticky, translúcida con blur. Marca `ORBVITAL`,
  links (Home · My Health · Log Reading · Routine · Missions · 3D Orbit · Crew · Surgeon*), sesión de usuario.
  *`Surgeon` solo para rol `ADMIN`. En `< lg` se colapsa en menú hamburguesa.
- **Fondo**: imagen `web1.jpg` a pantalla completa con velo `canvas/20`.
- **IncidentNotificationCenter**: toasts de incidentes (SSE `/api/incidents/stream`) en esquina inferior.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ORBVITAL   Home  My Health  Log Reading  Routine  Missions  3D Orbit  Crew  (Surgeon)│
│                                                       Jane Doe ▏ [⎋]  | (Sign in)[Register]
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Índice de vistas

| # | Vista | Ruta | Estado |
| :-: | :--- | :--- | :-: |
| 01 | [Home / Landing](./01-home.md) | `/` | ✅ |
| 02 | [Sign in](./02-login.md) | `/login` | ✅ |
| 03 | [Register](./03-register.md) | `/register` | ✅ |
| 04 | [My Health — Digital Twin](./04-dashboard.md) | `/dashboard` | ✅ |
| 05 | Historical Trends | `/trends` | ⏳ |
| 06 | Vision AI (Live) | `/vision` | ⏳ |
| 07 | Log Reading (wizard 4 pasos) | `/readings/new` | ⏳ |
| 08 | Routine | `/routine` | ⏳ |
| 09 | Missions (lista) | `/missions` | ⏳ |
| 10 | Mission detail | `/missions/[id]` | ⏳ |
| 11 | Mission form (new / edit) | `/missions/new`, `/missions/[id]/edit` | ⏳ |
| 12 | 3D Orbit Visualizer | `/visualizer` | ⏳ |
| 13 | Crew (lista) | `/astronauts` | ⏳ |
| 14 | Astronaut form (new / edit) | `/astronauts/new`, `/astronauts/[id]/edit` | ⏳ |
| 15 | Flight Surgeon Console | `/admin` | ⏳ |
| 16 | 404 Not found | `*` | ⏳ |

## Flujo principal

```
01 Home ──(Register)──▶ 03 Register ──▶ 01 Home
   │ └──(Sign in)────▶ 02 Login ─────▶ 01 Home
   ├──(Log Reading)──▶ 07 Log Reading ──▶ 04 Dashboard
   ├──(3D NRHO Orbit)▶ 12 Visualizer
   └──(My Health)────▶ 04 Dashboard ⇄ 05 Trends ⇄ 06 Vision
```
