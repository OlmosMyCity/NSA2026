# Supervisión desde Tierra y vigencia de datos (15 min)

> Propuesta de diseño. Organiza la idea del rol "empresario" y del recordatorio de 15 minutos, la aterriza sobre el código real del repositorio y lista las correcciones que necesita `ZeroG_Vitals_Arquitectura_y_Reglas.md`.
> Estado: decisiones D1–D7 **resueltas según la recomendación** de la sección 9. Bloques 0 a 3 implementados (base, vigencia, aptitud y rol operador). Pendiente: aplicar el cambio de esquema en la base de datos, la pantalla para crear operadores y el bloque 4 (pulido).

## Índice

1. [Resumen y recomendaciones clave](#1-resumen-y-recomendaciones-clave)
2. [Lo que encontré en el repositorio](#2-lo-que-encontré-en-el-repositorio)
3. [Módulo A: rol de supervisión desde Tierra](#3-módulo-a-rol-de-supervisión-desde-tierra)
4. [Módulo B: aptitud por destino](#4-módulo-b-aptitud-por-destino)
5. [Módulo C: vigencia de 15 minutos y recordatorio](#5-módulo-c-vigencia-de-15-minutos-y-recordatorio)
6. [Diseño e interacción](#6-diseño-e-interacción)
7. [Correcciones a la arquitectura (Parte 1 del md)](#7-correcciones-a-la-arquitectura-parte-1-del-md)
8. [Correcciones a las reglas de negocio (Parte 2 del md)](#8-correcciones-a-las-reglas-de-negocio-parte-2-del-md)
9. [Decisiones pendientes](#9-decisiones-pendientes)
10. [Plan de entrega](#10-plan-de-entrega)

---

## 1. Resumen y recomendaciones clave

| Lo que pediste | Lo que recomiendo | Por qué |
|---|---|---|
| Un sistema de login para un rol "empresario" | **Agregar un tercer rol** (`OPERATOR`) al login que ya existe. No hace falta un sistema nuevo | Ya hay JWT con roles `ADMIN` (cirujano de vuelo) y `USER` (astronauta) |
| Que vea estado, lugar, aptitud y última fecha | Una vista `/operator` con **solo esos cuatro datos**. Nunca los valores clínicos (FC, glucosa, notas, alertas) | Es un empleador viendo datos médicos de sus empleados: el mínimo necesario protege al astronauta y al proyecto |
| Aptitud tipo menú, un valor por destino | Un evaluador puro y determinista: `(estado por zona, vigencia, destino) → veredicto + motivo` | Encaja con el motor de reglas actual y con la regla "cada color se explica" |
| Recordatorio a los 15 min | Cuenta regresiva calculada en el cliente a partir de `expiresAt` que devuelve el servidor | El backend corre en funciones serverless: no hay proceso que pueda disparar un temporizador |
| No dejar revisar datos pasados después de 15 min | ⚖️ **Bloquear el estado, no el historial**: a los 15 min el panel pasa a "sin datos vigentes" y no muestra color ni aptitud. El historial sigue disponible, marcado como histórico | Ocultar el historial rompe tendencias, línea base, auditoría y la atención de emergencias. El riesgo real es confundir un dato viejo con el estado actual |
| 15 min para todos los datos | ⚖️ 15 min para los **signos vivos** (FC, SpO₂, presión, temperatura). Sueño, ánimo y glucosa conservan una vigencia más larga | Nadie puede reportar "horas de sueño" ni pincharse el dedo cada 15 minutos; además genera fatiga de alarmas |

---

## 2. Lo que encontré en el repositorio

Estos hallazgos condicionan todo lo demás.

| # | Hallazgo | Consecuencia |
|---|---|---|
| H1 | El md describe **Spring Boot + Java + Flyway**. El código real es **Express + TypeScript + Prisma** (backend) y **Next.js 14** (frontend) | La Parte 1 del md no describe este repositorio. Se corrige el documento, no el lenguaje (sección 7) |
| H2 | El md llama al producto *ZeroG Vitals*; el código y `PRODUCT.md` lo llaman **Orbvital** | Hay que elegir un nombre |
| H3 | El md dice que mandan `CLAUDE.md` y el SPEC. **Ninguno existe** en el repositorio | Hoy no hay fuente de verdad escrita |
| H4 | El login **ya existe**: `POST /api/auth/login`, JWT, `authenticate` + `authorizeRoles`. El registro público siempre crea `USER`; los `ADMIN` salen del seed | El trabajo es agregar un rol y su alcance |
| H5 | No existe ubicación por astronauta. Solo `Mission.environment` (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`) | "Lugar donde se encuentra" requiere un campo nuevo |
| H6 | `AdminTriageController` devuelve `OK` y **valores inventados** (70 lpm, 118/76, SpO₂ 98) cuando el astronauta no tiene lecturas | Contradice T7 ("sin datos nunca es NORMAL"). Hay que corregirlo antes de construir la vista de supervisión encima |
| H7 | Existen `PUT` y `DELETE` en `/api/readings/:id` | Contradice BR-01 ("los datos de salud solo se agregan") |
| H8 | La vigencia actual es de **12 a 48 horas** por indicador (`overdueHours` en `digitalTwin.ts`) | Pasar a 15 minutos es un cambio de dos órdenes de magnitud; conviene que sea configurable |
| H9 | `AdminTriageController` consulta Prisma directamente desde el controlador | Rompe la regla de dependencias del propio md |
| H10 | `apps/frontend/.agents` y `apps/frontend/skills` son **enlaces simbólicos rotos** (apuntan a `apps/.agents` y `apps/skills`, que no existen) | La guía *impeccable* no está en el repositorio. Ver sección 6 |
| H11 | `ai/vision` ya mide FC, ánimo y sueño **sin contacto** por cámara | Es la salida natural para que renovar datos cada 15 min tome segundos y no un formulario de 8 campos |

---

## 3. Módulo A: rol de supervisión desde Tierra

### 3.1 Nombre del rol

Propongo `OPERATOR` en el código y **"Mission Operator"** en la interfaz (la interfaz está en inglés según `PRODUCT.md`). "Empresario" describe a la persona; "operador" es el término de la industria para la empresa responsable de la tripulación, y evita confundirlo con el `role` del astronauta (comandante, piloto…).

| Rol | Quién es | Qué ve |
|---|---|---|
| `USER` | Astronauta | Sus propios datos |
| `ADMIN` | Cirujano de vuelo | Todo, con valores clínicos |
| `OPERATOR` *(nuevo)* | Empresa en Tierra | Resumen de **sus** astronautas, sin valores clínicos |

### 3.2 Alcance: "sus astronautas"

El operador solo ve a los astronautas de las misiones que tiene asignadas.

```prisma
enum Role { ADMIN USER OPERATOR }

model Mission {
  // …campos actuales
  operatorId String?
  operator   User?   @relation("MissionOperator", fields: [operatorId], references: [id], onDelete: SetNull)
}
```

Un operador por misión y varias misiones por operador alcanza para el MVP. Si más adelante una misión tiene varios operadores, se cambia por una tabla intermedia.

### 3.3 Alta de cuentas

El registro público **no** debe poder crear operadores: es un rol que ve datos de terceros. La cuenta la crea un `ADMIN` (endpoint `POST /api/admin/users`) o el seed, y el `ADMIN` asigna la misión.

### 3.4 Qué ve el operador

| Dato | Origen | Nota |
|---|---|---|
| **Estado general** | Estado de la última lectura **vigente** | `OK` / `WARNING` / `CRITICAL` / `NO_DATA`. Si la lectura venció, es `NO_DATA` |
| **Ubicación** | Campo nuevo `Astronaut.currentLocation` | Con la hora en que se declaró |
| **Aptitud por destino** | Evaluador del Módulo B | Menú de destinos; cada uno devuelve su veredicto |
| **Última fecha de registro** | `takenAt` de la última lectura | Se muestra **siempre**, incluso vencida: es justo el dato que le dice si la información es confiable |

**Lo que no ve:** valores numéricos, texto de alertas, recomendaciones, notas, ánimo, tendencias ni el gemelo 3D. El recorte se hace **en el servidor** (el DTO no trae esos campos), no ocultándolos en la interfaz.

### 3.5 Ubicación

```prisma
enum CrewLocation { CREW_CABIN HABITAT ROVER EVA STORM_SHELTER MEDICAL_BAY }

model Astronaut {
  // …campos actuales
  currentLocation   CrewLocation?
  locationUpdatedAt DateTime?
}
```

El astronauta la declara al registrar una lectura (un paso más en `ReadingFormWizard`) o con un control rápido en su panel. Así la ubicación tiene la misma frescura que los datos de salud. El historial de ubicaciones queda fuera del MVP.

### 3.6 API

| Método | Ruta | Rol | Devuelve |
|---|---|---|---|
| `GET` | `/api/operator/crew` | `OPERATOR` | Lista de tarjetas de su tripulación |
| `PATCH` | `/api/astronauts/:id/location` | `USER` (propio), `ADMIN` | Ubicación actualizada |
| `POST` | `/api/admin/users` | `ADMIN` | Cuenta nueva con rol |

Forma de cada tarjeta:

```jsonc
{
  "astronautId": "…",
  "name": "…",
  "crewRole": "Commander",
  "missionName": "…",
  "status": "WARNING",              // o NO_DATA si venció
  "location": "HABITAT",
  "locationUpdatedAt": "2026-11-14T22:41:00Z",
  "lastReadingAt": "2026-11-14T22:40:00Z",
  "expiresAt": "2026-11-14T22:55:00Z",
  "isFresh": true,
  "readiness": [
    { "destination": "EVA",   "verdict": "NOT_FIT",          "reasonCode": "CARDIO_WARNING" },
    { "destination": "ROVER", "verdict": "FIT_WITH_CAUTION", "reasonCode": "CARDIO_WARNING" }
  ],
  "serverTime": "2026-11-14T22:47:10Z"
}
```

Todos los destinos van en la misma respuesta: son pocos, el menú cambia al instante y funciona sin red. La vista se refresca por sondeo cada 30–60 s (no hay WebSockets en funciones serverless).

### 3.7 Seguridad

- Cada consulta filtra por `mission.operatorId = req.user.id`. Pedir un astronauta ajeno devuelve `403`.
- `authorizeRoles(Role.OPERATOR)` en todo el router, igual que hoy con `adminRouter`.
- El operador no tiene ninguna ruta de escritura sobre datos de salud.
- Pruebas obligatorias: operador A no ve la tripulación de B; el DTO no contiene campos clínicos.

---

## 4. Módulo B: aptitud por destino

### 4.1 Contrato

Función pura en `application/health/` (donde ya viven `evaluateReading`, `digitalTwin` y `hazards`):

```
evaluateReadiness(estadoPorZona, esVigente, destino) → { verdict, reasonCode }
```

Veredictos: `FIT` · `FIT_WITH_CAUTION` · `NOT_FIT` · `NO_DATA`.

### 4.2 Matriz propuesta

El estado por zona ya lo calcula el gemelo digital (corazón, cerebro, sangre, huesos, sueño).

| Destino | Todo en verde | Ámbar solo en sueño o huesos | Ámbar en corazón, sangre o cerebro | Cualquier rojo | Datos vencidos |
|---|---|---|---|---|---|
| **EVA** (caminata) | `FIT` | `FIT_WITH_CAUTION` | `NOT_FIT` | `NOT_FIT` | `NO_DATA` |
| **Rover** (excursión) | `FIT` | `FIT_WITH_CAUTION` | `FIT_WITH_CAUTION` | `NOT_FIT` | `NO_DATA` |
| **Hábitat / base** (trabajo presurizado) | `FIT` | `FIT` | `FIT_WITH_CAUTION` | `NOT_FIT` | `NO_DATA` |
| **Tránsito entre módulos** | `FIT` | `FIT` | `FIT` | `FIT_WITH_CAUTION` | `NO_DATA` |
| **Refugio de tormenta** | `FIT` | `FIT` | `FIT` | `FIT` | `FIT` |

Reglas que acompañan la matriz:

1. **Datos vencidos → `NO_DATA`**, nunca `FIT`. Es la misma idea de T7.
2. **El refugio nunca se bloquea.** Ir al refugio es una medida de protección, no una actividad opcional.
3. **Es orientación, no autorización.** La decisión sigue siendo del oficial médico (BR-15). El operador ve el veredicto; no puede aprobar ni vetar.
4. Los valores de la matriz viven en un archivo de configuración (`destinationProfiles.ts`, junto a `hazards.ts`), no dispersos en `if`.
5. Cada veredicto lleva un `reasonCode`. Al astronauta y al cirujano se les muestra el motivo completo; al operador, uno genérico ("Medical hold", "Reading expired") para no filtrar datos clínicos.

Los umbrales de la matriz son una propuesta razonada, no un criterio de la NASA: deben quedar marcados como `CMO_CONFIGURABLE` (R4).

---

## 5. Módulo C: vigencia de 15 minutos y recordatorio

### 5.1 La regla

Una lectura es **vigente** durante 15 minutos desde `takenAt`. Pasado ese tiempo:

- el estado general pasa a `NO_DATA` ("Reading expired · Measure now");
- la aptitud de todos los destinos pasa a `NO_DATA` (salvo el refugio);
- el operador ve `NO_DATA` y la fecha de la última lectura.

La vigencia **se calcula al leer**, no se guarda: `isFresh = serverNow − takenAt ≤ ventana`. El `status` almacenado en la lectura no cambia (sigue siendo el resultado histórico del triaje).

La ventana va en configuración (`FRESHNESS_WINDOW_MIN = 15`), no escrita en el código.

### 5.2 ⚖️ Qué significa "no revisar datos pasados"

| | Opción A: bloqueo total (tu idea literal) | Opción B: bloqueo del estado (recomendada) |
|---|---|---|
| Panel del astronauta tras 15 min | Bloqueado | Bloqueado: sin color, sin aptitud, con el botón "Measure now" |
| Historial y tendencias del astronauta | Ocultos | Visibles, con la etiqueta "Historical · not current" y la antigüedad de cada dato |
| Cirujano de vuelo | Debe conservar acceso completo | Acceso completo |
| Riesgo que cubre | Decidir con un dato viejo | Decidir con un dato viejo |
| Costo | Se pierden tendencias (`/trends`), la explicación del triaje y el contexto en una emergencia | Ninguno funcional |

Recomiendo la **B**. El peligro no es que el astronauta *vea* un dato de hace una hora, sino que el sistema se lo presente como su estado actual. Con la B eso es imposible y el astronauta conserva la información que le permite notar que está empeorando. Si prefieres la A, el alcance es el mismo salvo que `/trends` y el historial quedan restringidos a `ADMIN`.

En ambas opciones:

- **El historial nunca se borra** (BR-01) y el cirujano siempre lo ve.
- **La emergencia nunca se bloquea** (R5). Un astronauta con datos vencidos puede abrir el protocolo igual.

### 5.3 ⚖️ Qué indicadores vencen a los 15 min

La lectura actual exige 8 valores a mano: FC, presión, glucosa, temperatura, SpO₂, horas de sueño y ánimo. Renovar todo cada 15 minutos no es viable (las horas de sueño no cambian; la glucosa implica un pinchazo) y produce el efecto contrario al buscado: fatiga de alarmas y datos copiados sin medir.

| Grupo | Indicadores | Vigencia propuesta |
|---|---|---|
| Signos vivos | FC, SpO₂, presión, temperatura | **15 min** |
| Lentos | Glucosa, ánimo | 12 h (como hoy) |
| Diarios | Horas de sueño | 24 h (como hoy) |

El estado general exige que los signos vivos estén vigentes. Para que renovarlos sea rápido, el camino es la medición por cámara de `ai/vision` (H11) o una "lectura rápida" de solo esos cuatro campos, con los lentos precargados.

### 5.4 Recordatorio

El servidor no puede disparar temporizadores (serverless), así que el recordatorio se deriva en el cliente a partir de `expiresAt` y `serverTime` (para no depender del reloj del dispositivo):

| Momento | Qué pasa |
|---|---|
| 0 – 13 min | Anillo de cuenta regresiva discreto junto al estado |
| 13 min | Aviso previo: "Reading expires in 2 min" |
| 15 min | El panel pasa a `NO_DATA`, aparece el recordatorio y el botón "Measure now" |
| Nueva lectura | El panel se desbloquea y el anillo se reinicia |

- No hay "posponer": el recordatorio se puede descartar, pero el panel sigue en `NO_DATA` hasta que haya una lectura nueva.
- Funciona sin conexión (R1): el temporizador es local.
- **Modo descanso** (recomendado): durante el sueño no se envían recordatorios. El operador ve "Resting" en lugar de una fila de `NO_DATA` cada noche.
- Renovar a tiempo puede dar puntos: es una conducta, no un valor de salud (R6).

---

## 6. Diseño e interacción

Se mantiene el mundo visual actual: consola oscura de misión, colores de estado luminosos, precisión de instrumento, texto en inglés.

> *Impeccable* no está disponible en el repositorio (H10: enlaces rotos). Apliqué *apple-design* y *animation-vocabulary*; si restauras `apps/.agents` y `apps/skills`, se revisa esta sección contra esa guía antes de implementar.

### 6.1 Vista del operador (`/operator`)

- **Jerarquía:** una tarjeta por astronauta, ordenadas por gravedad. En cada tarjeta, de mayor a menor peso: estado → aptitud → ubicación → última lectura.
- **Menú de destinos:** control segmentado dentro de la tarjeta. Al cambiar de destino, el veredicto cambia en el mismo lugar.
- **Materiales:** barra superior translúcida con el contenido pasando por debajo; las tarjetas sobre capa sólida para que el color de estado no se mezcle con el fondo.
- **Tipografía:** fuente del sistema, cifras de tiempo con *tabular numbers*, títulos con tracking negativo y cuerpo cerca de 0.

### 6.2 Movimiento (vocabulario exacto)

| Elemento | Efecto | Detalle |
|---|---|---|
| Carga de la lista | **Skeleton / Shimmer** → **Stagger** de **Fade in** | Retraso corto entre tarjetas; solo en la primera carga |
| Cambio de destino en el menú | **Layout animation** del indicador + **Crossfade** del veredicto | Resorte sin rebote (amortiguación 1.0, respuesta ~0.3 s); interrumpible |
| Tiempo desde la última lectura | **Tabular numbers**, sin animar cada tic | Se ve cada segundo: por *frequency of use* debe ser casi invisible |
| Anillo de vigencia | **Line drawing** del arco, progreso lineal | El progreso de un temporizador es de los pocos casos donde lo lineal es correcto |
| Vencimiento (15 min) | **Continuity transition**: la misma tarjeta pierde color y pasa a gris; **Crossfade** del contenido | Sin sacudidas ni destellos: es un cambio de estado, no un error |
| Recordatorio | **Slide in** desde arriba; **Swipe to dismiss** hacia arriba | Entra y sale por el mismo camino |
| Cambio de estado de un astronauta | **Text morph** en la etiqueta + un solo **Pulse** | Un pulso, no un bucle: los bucles lentos molestan y desgastan la atención |
| Botones | **Press / Tap feedback** al presionar | Respuesta en el *pointer-down*, no al soltar |
| Detalle de un astronauta | **Shared element transition** tarjeta → panel | Nace de la tarjeta y vuelve a ella |

### 6.3 Accesibilidad

- El estado nunca depende solo del color: siempre lleva etiqueta e icono.
- `prefers-reduced-motion`: se reemplazan deslizamientos y resortes por *crossfade* corto; el anillo se vuelve un texto ("4 min left").
- `prefers-reduced-transparency` y `prefers-contrast`: la barra pasa a fondo sólido con borde definido.
- Solo se animan `transform` y `opacity`.

---

## 7. Correcciones a la arquitectura (Parte 1 del md)

No se cambia el lenguaje: se corrige el documento para que describa lo que hay.

### 7.1 Equivalencia de capas

| El md dice (Spring Boot) | El repositorio tiene (TypeScript) |
|---|---|
| `controller/` | `interface/controllers/` + `interface/routers/` |
| `dto/` + Bean Validation | `interface/validation/schemas.ts` |
| `service/` + `impl/` | `application/use-cases/<recurso>/XxxUseCase.ts` |
| `domain/` (Java puro) | `domain/models/` + reglas puras en `application/health/` |
| `repository/` (Spring Data) | `domain/repository/IXxxRepository.ts` + `infrastructure/repository/PrismaXxxRepository.ts` |
| `entity/` + Flyway | `prisma/schema.prisma` + migraciones de Prisma |
| `exception/` + `@RestControllerAdvice` | `domain/errors/AppError.ts` + `middlewares/errorHandler.ts` |
| `security/` (vacío) | `middlewares/authenticate.ts`, `authorizeRoles.ts`, `TokenService`, `PasswordHasher` |
| `config/` + `resources/data/*.json` | Constantes en `application/health/*.ts` y variables de entorno |
| Frontend: no se describe | `apps/frontend/src/features/<módulo>/{components,domain,hooks,services}` |

### 7.2 Regla de dependencias, reescrita

```
routers → controllers → use-cases → domain (modelos, interfaces de repositorio, reglas puras)
                                  ↑
                    infrastructure (Prisma) implementa las interfaces
```

- Las reglas puras no importan Express, Prisma ni la hora del sistema (reciben `now`).
- El controlador no consulta la base de datos.

### 7.3 Deuda que conviene pagar junto con esta funcionalidad

| Prioridad | Qué | Por qué ahora |
|---|---|---|
| Alta | `AdminTriageController`: quitar los valores inventados y el `OK` por defecto (H6) | La vista del operador reutiliza la misma lógica |
| Alta | Mover la consulta de `AdminTriageController` a un caso de uso + repositorio (H9) | El caso de uso del operador comparte la consulta |
| Media | `RouteGuard` acepta un solo rol; debe aceptar una lista | Hay tres roles |
| Media | Decidir qué pasa con `PUT`/`DELETE` de lecturas (H7) | Ver BR-01 abajo |
| Baja | Elegir un solo nombre de producto (H2) y crear el `CLAUDE.md` que el md cita (H3) | Hoy no hay fuente de verdad |
| Baja | Reparar o quitar los enlaces simbólicos rotos (H10) | Las guías de diseño no cargan |

### 7.4 Dónde va cada pieza nueva

| Pieza | Ubicación |
|---|---|
| Rol, ubicación, operador de misión | `prisma/schema.prisma` + migración |
| Vigencia | `application/health/freshness.ts` (pura) |
| Aptitud por destino | `application/health/readiness.ts` + `destinationProfiles.ts` (puras) |
| Resumen para el operador | `application/use-cases/operator/GetOperatorCrewOverviewUseCase.ts` |
| Rutas | `interface/routers/operatorRouter.ts`, `controllers/OperatorController.ts` |
| Vista | `apps/frontend/src/app/operator/page.tsx` + `features/operator/` |
| Temporizador y bloqueo | `features/health/hooks/useReadingFreshness.ts` |

---

## 8. Correcciones a las reglas de negocio (Parte 2 del md)

### 8.1 Reglas que cambian

| Regla | Hoy | Propuesta |
|---|---|---|
| **R1** Offline-first | "El servidor es el computador del hábitat" | La supervisión desde Tierra necesita enlace. Aclarar: a bordo todo funciona sin conexión; la vista del operador muestra la hora del último dato recibido |
| **R5** Emergencia sin identificación | — | Agregar: tampoco la bloquea la vigencia de los datos |
| **Tabla 2.2** Escalamiento | Cuatro destinatarios | El operador **no** es un destinatario de escalamiento clínico. Ve el estado; no recibe alertas médicas |
| **T7** Vigencia | Sensor 10 min, guiada 26 h… | Signos vivos 15 min; el resto según 5.3. Hoy T7 y el código (12–48 h) ya no coinciden |
| **BR-01** Solo se agrega | Sin `PUT` ni `DELETE` | El código los tiene. Elegir: quitarlos, o limitar la corrección al `ADMIN` con registro de auditoría |
| **BR-11** Vigencia por origen | Remite a T7 | Remite a la nueva regla de vigencia |
| **BR-12** Recordatorios | Entidad persistida con `SNOOZED` y `@Scheduled` | El recordatorio de vigencia es **derivado** (no se guarda, no se pospone). `@Scheduled` no aplica en serverless |
| **BR-15** / **2.7** Aptitud | Solo `PRE_EVA`, `POST_EVA`, `GRAVITY_TRANSITION` | Se suma la aptitud por destino como orientación continua; la aprobación del CMO sigue igual |
| **2.4** Integridad | "La base rechaza valores imposibles" con `CHECK` | Hoy lo valida `schemas.ts`, no la base. Documentar lo real o agregar los `CHECK` |

### 8.2 Reglas nuevas

| ID | Regla |
|---|---|
| **R8** | **Mínimo necesario:** el operador ve estado, ubicación, aptitud y fecha. Nunca valores clínicos, alertas ni notas. El recorte se hace en el servidor |
| **BR-23** | Un operador solo accede a astronautas de misiones que tiene asignadas |
| **BR-24** | Las cuentas de operador las crea un `ADMIN`; el registro público solo crea astronautas |
| **BR-25** | La vigencia se calcula al leer con la hora del servidor; nunca se guarda ni se confía en el reloj del cliente |
| **BR-26** | Con signos vivos vencidos, el estado y la aptitud son `NO_DATA`. Un dato vencido nunca se muestra como estado actual |
| **BR-27** | El historial no se borra por vencimiento y el cirujano de vuelo siempre lo ve |
| **BR-28** | La aptitud por destino es determinista, lleva motivo y es orientativa; no reemplaza la decisión del CMO |
| **BR-29** | El refugio de tormenta siempre es `FIT` |
| **BR-30** | La ubicación la declara el astronauta o el `ADMIN`; el operador no la modifica |
| **BR-31** | Durante el modo descanso no se emiten recordatorios y el operador ve "Resting" |

---

## 9. Decisiones pendientes

| # | Decisión | Mi recomendación |
|---|---|---|
| D1 | ¿Bloqueo total del historial (A) o solo del estado (B)? | **B** (5.2) |
| D2 | ¿15 min para todo o solo para signos vivos? | **Solo signos vivos** (5.3) |
| D3 | ¿El operador ve valores clínicos? | **No** (3.4) |
| D4 | ¿Nombre del rol? | `OPERATOR` / "Mission Operator" |
| D5 | ¿Qué destinos entran al menú? | Los cinco de 4.2 |
| D6 | ¿`PUT`/`DELETE` de lecturas? | Quitarlos para `USER`; corrección solo `ADMIN` con auditoría |
| D7 | ¿Nombre del producto? | Orbvital (es el que usa el código) |

D1 y D2 son las que más cambian el alcance.

---

## 10. Plan de entrega

| Fase | Contenido | Depende de |
|---|---|---|
| **0. Base** | Corregir H6 y H9; `RouteGuard` multi-rol; actualizar el md con las secciones 7 y 8 | — |
| **1. Vigencia** | `freshness.ts`, `expiresAt` en las respuestas, anillo, bloqueo y recordatorio en el panel del astronauta | D1, D2 |
| **2. Aptitud** | `readiness.ts`, matriz, pruebas de cada celda | D5 |
| **3. Operador** | Rol, migración, ubicación, `/api/operator/crew`, vista `/operator`, alta de cuentas por `ADMIN` | D3, D4 |
| **4. Pulido** | Movimiento, accesibilidad, modo descanso, lectura rápida o por cámara | Fases 1–3 |

Pruebas mínimas: vigencia en el límite (14:59, 15:00, 15:01); cada celda de la matriz; aislamiento entre operadores; el DTO del operador no contiene campos clínicos; astronauta sin lecturas devuelve `NO_DATA`.
