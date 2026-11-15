# Reglas de negocio de los datos de salud

Principios que siguen el backend y la base de datos de OrbVital. Se adaptaron del proyecto anterior (Java / JPA / Flyway) a este stack (TypeScript / Prisma / Zod), respetando las capas del backend:
`domain` → `application/use-cases` → `infrastructure` (Prisma) → `interface` (routers, controladores, Zod).

| # | Principio | Estado | Dónde se aplica |
|---|---|---|---|
| **P1** | **Los datos de salud solo se agregan.** Una lectura no se edita ni se borra. Una lectura errónea se **invalida** con un motivo; una corrección es una **lectura nueva** que apunta a la original. | ✅ | API y base de datos (ver abajo) |
| **P2** | Momentos en UTC; "día" en hora de misión | ⏳ Pendiente | Pasar a `timestamptz` y crear `missionDay()` en el dominio |
| **P3** | La unidad va en el nombre | ✅ (código) | `heartRateBpm`, `spo2Pct`, `glucoseMgDl`… Falta `snake_case` en la base con `@map` |
| **P4** | Enums como texto | ✅ Equivalente | Enums nativos de Postgres: texto validado por la base |
| **P5** | Rangos **físicamente posibles** en la base; rangos **clínicos** nunca | ✅ | `CHECK` en `health_readings` + Zod. Lo peligroso lo decide `evaluateReading` |
| **P6** | Sin borrado físico | ✅ | Lecturas: trigger + FK `RESTRICT`. Astronautas y misiones: borrado lógico (`deletedAt`) |
| **P7** | El esquema solo cambia con migraciones | ✅ | Prisma Migrate (equivalente a Flyway). Nunca `db push` en producción |
| **P8** | IDs `BIGINT IDENTITY` | ❌ No se adopta | Los IDs son texto (UUID / `astro-01`) y el frontend depende de ellos. Migrarlos no aporta valor a la demo |

## P1 en detalle

### API

| Acción | Endpoint | Quién |
|---|---|---|
| Registrar lectura | `POST /api/readings` | El tripulante (las suyas) o ADMIN |
| Invalidar lectura | `POST /api/readings/:id/invalidate` `{ reason }` | El tripulante (las suyas) o ADMIN |
| Corregir lectura | `POST /api/readings/:id/corrections` `{ ...vitales, reason }` | El tripulante (las suyas) o ADMIN |
| Editar / borrar | `PUT`, `PATCH`, `DELETE /api/readings/:id` | **405**: no existen |
| Auditoría | `GET /api/readings?includeInvalid=true` | Incluye las invalidadas |

- El motivo es obligatorio (5–500 caracteres) y la invalidación es **definitiva**.
- La corrección se re-evalúa con `evaluateReading`, conserva el astronauta y, por defecto, el `takenAt` de la original, y abre los incidentes que correspondan.
- Corregir crea la lectura nueva e invalida la original **en una sola transacción**.
- Dashboards, resumen, triage, gemelo digital y Vision AI usan **solo lecturas válidas**.

Casos de uso: `InvalidateHealthReadingUseCase`, `CorrectHealthReadingUseCase`
(se eliminaron `UpdateHealthReadingUseCase` y `DeleteHealthReadingUseCase`).

### Base de datos (migración `20261115000000_immutable_health_data`)

- Columnas nuevas: `isValid`, `invalidatedAt`, `invalidatedReason`, `invalidatedById`, `supersedesId` (única).
- Trigger `health_readings_append_only`:
  - prohíbe `DELETE`;
  - prohíbe cambiar valores clínicos, estado, alertas, notas o fechas;
  - solo permite invalidar (`isValid` de `true` a `false`), y no se puede revertir.
- `CHECK` de rangos físicamente posibles (los mismos de Zod) y de invalidación completa (fecha + motivo).
- La FK `astronautId` pasó de `CASCADE` a `RESTRICT`: un astronauta con lecturas no se puede borrar físicamente.
- Las lecturas antiguas con `deletedAt` se migraron a `isValid = false`. La columna `deletedAt` queda obsoleta.

**Única excepción (seeds y mantenimiento):** dentro de una transacción,
`SET LOCAL orbvital.allow_health_purge = 'on';` desactiva el trigger. Lo usan `prisma/seed.ts` y `prisma/seed.sql` para reemplazar sus propios datos de demo.

## P7: cómo aplicar migraciones

Hasta ahora el esquema se aplicaba con `prisma db push`. Desde ahora:

### Base nueva
```bash
cd apps/backend && npm run prisma:deploy
```

### Base existente (creada con `db push`), una sola vez
Marcar como aplicadas las migraciones que la base ya tiene y aplicar las nuevas:
```bash
cd apps/backend
npx prisma migrate resolve --applied 20261101000000_baseline
npx prisma migrate resolve --applied 20261114_directives_and_cleanup
npm run prisma:deploy
```
Si `20261114_directives_and_cleanup` nunca se ejecutó en esa base, no la marques: `prisma:deploy` la aplica (es idempotente).

### Cambios futuros
```bash
npx prisma migrate dev --name descripcion_del_cambio   # en local, genera la migración
npm run prisma:deploy                                  # en producción
```
Las migraciones ya aplicadas **nunca se editan**: cada cambio es una migración nueva.

> ⚠️ **Orden de despliegue:** aplica las migraciones **antes** de publicar el backend que las necesita. Vercel no ejecuta migraciones al compilar.
