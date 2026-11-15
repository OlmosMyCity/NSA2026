/**
 * Genera `prisma/seed.sql` a partir de `prisma/seedData.ts` (los mismos datos que `prisma db seed`).
 *
 *   npm run seed:sql
 *
 * El SQL resultante es una sola transacción, no destructiva, con fechas relativas a now().
 * Pensado para pegarlo en el SQL Editor de Supabase / Neon cuando no hay Node a mano.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { buildSeedData, SEED_USERS, COMMANDER_ASTRONAUT_ID } from "../prisma/seedData.js";

const OUT = path.resolve(__dirname, "../prisma/seed.sql");

// Los IDs reales de los usuarios pueden diferir (upsert por email): se resuelven en SQL.
const ADMIN = "__ADMIN_ID__";
const CREW = "__CREW_ID__";
const userRef = (email: string) => `(SELECT id FROM users WHERE email = ${quote(email)})`;

const data = buildSeedData({ adminId: ADMIN, commanderUserId: CREW });
const NOW = data.now.getTime();

function quote(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v === ADMIN) return userRef(SEED_USERS.admin.email);
  if (v === CREW) return userRef(SEED_USERS.commander.email);
  if (v instanceof Date) {
    const ms = NOW - v.getTime();
    return `(timezone('utc', now()) - interval '${ms} milliseconds')`;
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return quote(v);
  return `${quote(JSON.stringify(v))}::jsonb`;
}

function insert(table: string, rows: Record<string, unknown>[], onConflict = "", defaults: Record<string, unknown> = {}) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)).concat(Object.keys(defaults)))];
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const values = rows
      .slice(i, i + 100)
      .map((r) => `  (${cols.map((c) => literal(c in r ? r[c] : defaults[c])).join(", ")})`)
      .join(",\n");
    chunks.push(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n${values}${onConflict ? `\n${onConflict}` : ""};`);
  }
  return chunks.join("\n");
}

const updateSet = (cols: string[]) => cols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");

async function main() {
const [adminHash, crewHash] = await Promise.all([
  bcrypt.hash(SEED_USERS.admin.password, 10),
  bcrypt.hash(SEED_USERS.commander.password, 10),
]);
const now = data.now;
const users = [
  { ...SEED_USERS.admin, passwordHash: adminHash },
  { ...SEED_USERS.commander, passwordHash: crewHash },
].map(({ id, email, name, passwordHash, role }) => ({ id, email, name, passwordHash, role, state: "ACTIVE", createdAt: now, updatedAt: now, deletedAt: null }));

const readingDefaults = { isValid: true, invalidatedAt: null, invalidatedReason: null, invalidatedById: null, supersedesId: null, deletedAt: null };
const incidentDefaults = { astronautId: null, readingId: null, protocolId: null, acknowledgedAt: null, acknowledgedById: null, closedAt: null, closedById: null, resolutionNotes: null };

const sql = `-- ============================================================================
-- OrbVital (NSA2026) — datos de prueba y estadísticas
-- Generado por apps/backend/scripts/generateSeedSql.ts a partir de prisma/seedData.ts.
-- No editar a mano: si cambia el seed, ejecutar \`npm run seed:sql\`.
--
-- Uso: pegar y ejecutar completo en el SQL Editor de Supabase (o Neon), o
--   psql "$DIRECT_URL" -f prisma/seed.sql
-- Es una sola transacción: si algo falla, no se escribe nada.
-- Modo no destructivo: reemplaza solo filas con id 'seed-%' y hace upsert de
-- usuarios (por email), misiones (mission-01..06) y astronautas (astro-01..15).
-- Las fechas son relativas a now(), así que los datos quedan al día.
-- Contraseñas: ${SEED_USERS.admin.email} / ${SEED_USERS.admin.password}, ${SEED_USERS.commander.email} / ${SEED_USERS.commander.password}
-- ============================================================================

BEGIN;

-- (Opcional) Borrado total, equivalente a \`prisma db seed -- --reset\`.
-- Quitar los comentarios SOLO si la base tiene únicamente datos de demo.
-- SET LOCAL orbvital.allow_health_purge = 'on';
-- TRUNCATE directives, incidents, health_readings, astronauts, missions, users CASCADE;

-- health_readings es solo de agregado (trigger); el seed declara la excepción en su transacción
SET LOCAL orbvital.allow_health_purge = 'on';

DELETE FROM directives      WHERE id LIKE 'seed-%';
DELETE FROM incidents       WHERE id LIKE 'seed-%';
-- Lecturas del seed y las correcciones encadenadas a ellas (supersedesId)
CREATE TEMP TABLE seed_reading_chain ON COMMIT DROP AS
WITH RECURSIVE chain AS (
  SELECT id FROM health_readings WHERE id LIKE 'seed-%'
  UNION
  SELECT h.id FROM health_readings h JOIN chain c ON h."supersedesId" = c.id
) SELECT id FROM chain;
UPDATE health_readings SET "supersedesId" = NULL
WHERE id IN (SELECT id FROM seed_reading_chain) AND "supersedesId" IS NOT NULL;
DELETE FROM health_readings WHERE id IN (SELECT id FROM seed_reading_chain);

-- Usuarios
${insert("users", users, `ON CONFLICT ("email") DO UPDATE SET ${updateSet(["name", "passwordHash", "role", "state", "updatedAt", "deletedAt"])}`)}

-- Misiones (${data.missions.length})
${insert("missions", data.missions as Record<string, unknown>[], `ON CONFLICT ("id") DO UPDATE SET ${updateSet(["name", "description", "environment", "status", "startDate", "endDate", "patchUrl", "updatedAt", "deletedAt"])}`)}

-- El usuario de demo queda ligado solo a ${COMMANDER_ASTRONAUT_ID}
UPDATE astronauts SET "userId" = NULL
WHERE "userId" = ${userRef(SEED_USERS.commander.email)} AND id <> '${COMMANDER_ASTRONAUT_ID}';

-- Astronautas (${data.astronauts.length})
${insert("astronauts", data.astronauts as Record<string, unknown>[], `ON CONFLICT ("id") DO UPDATE SET ${updateSet(["missionId", "userId", "name", "role", "age", "photoUrl", "updatedAt", "deletedAt"])}`)}

-- Lecturas (${data.readings.length}; las inválidas quedan marcadas con isValid = false y su corrección apunta con supersedesId)
${insert("health_readings", data.readings as Record<string, unknown>[], "", readingDefaults)}

-- Incidentes (${data.incidents.length})
${insert("incidents", data.incidents as Record<string, unknown>[], "", incidentDefaults)}

-- Directivas (${data.directives.length})
${insert("directives", data.directives as Record<string, unknown>[], "", { incidentId: null, acknowledgedAt: null })}

COMMIT;

-- Comprobación rápida
SELECT 'health_readings' AS tabla, count(*) FROM health_readings WHERE id LIKE 'seed-%'
UNION ALL SELECT 'incidents', count(*) FROM incidents WHERE id LIKE 'seed-%'
UNION ALL SELECT 'directives', count(*) FROM directives WHERE id LIKE 'seed-%'
UNION ALL SELECT 'astronauts', count(*) FROM astronauts WHERE id LIKE 'astro-%'
UNION ALL SELECT 'missions', count(*) FROM missions WHERE id LIKE 'mission-0%';
`;

writeFileSync(OUT, sql);
console.log(`✅ ${OUT} (${data.readings.length} lecturas, ${data.incidents.length} incidentes, ${data.directives.length} directivas)`);
}

main().catch((e) => {
  console.error("❌ Error generando seed.sql:", e);
  process.exit(1);
});
