/**
 * Seed de datos de prueba y estadísticas para OrbVital (NSA2026).
 *
 * Uso:
 *   npx prisma db seed            → reemplaza solo los datos que crea este seed
 *   npx prisma db seed -- --reset → borra TODA la base y la vuelve a sembrar
 *
 * Los datos se generan en `prisma/seedData.ts` (misiones, 15 astronautas, ~1 000 lecturas,
 * incidentes y directivas). `npm run seed:sql` produce `prisma/seed.sql` con los mismos datos.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { buildSeedData, countBy, SEED_USERS, COMMANDER_ASTRONAUT_ID } from "./seedData.js";

const prisma = new PrismaClient();
const RESET = process.argv.includes("--reset") || process.env.SEED_RESET === "true";

/**
 * health_readings es solo de agregado (P1): un trigger bloquea DELETE.
 * El seed es la única excepción y lo declara explícitamente dentro de su transacción.
 * También elimina las correcciones encadenadas a sus lecturas (supersedesId),
 * que son datos de demo aunque las haya creado alguien desde la API.
 */
async function purgeHealthReadings(scope: "seed" | "all") {
  const chain =
    scope === "all"
      ? `SELECT id FROM health_readings`
      : `WITH RECURSIVE chain AS (
           SELECT id FROM health_readings WHERE id LIKE 'seed-%'
           UNION
           SELECT h.id FROM health_readings h JOIN chain c ON h."supersedesId" = c.id
         ) SELECT id FROM chain`;
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL orbvital.allow_health_purge = 'on'`),
    prisma.$executeRawUnsafe(`UPDATE health_readings SET "supersedesId" = NULL WHERE id IN (${chain}) AND "supersedesId" IS NOT NULL`),
    prisma.$executeRawUnsafe(`DELETE FROM health_readings WHERE id IN (${chain})`),
  ]);
}

async function main() {
  console.log(`🌱 OrbVital seed${RESET ? " (--reset: borrado total)" : ""}`);

  if (RESET) {
    await prisma.directive.deleteMany();
    await prisma.incident.deleteMany();
    await purgeHealthReadings("all");
    await prisma.astronaut.deleteMany();
    await prisma.mission.deleteMany();
    await prisma.user.deleteMany();
  } else {
    await prisma.directive.deleteMany({ where: { id: { startsWith: "seed-" } } });
    await prisma.incident.deleteMany({ where: { id: { startsWith: "seed-" } } });
    await purgeHealthReadings("seed");
  }

  // 1. Usuarios (upsert por email para respetar cuentas existentes)
  const { admin: a, commander: c, operator: o } = SEED_USERS;
  // Las contraseñas de demo (seedData.ts) solo se permiten fuera de producción; en producción deben venir del entorno.
  const isProduction = process.env.NODE_ENV === "production";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (isProduction ? undefined : a.password);
  const crewPassword = process.env.SEED_CREW_PASSWORD || (isProduction ? undefined : c.password);
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || (isProduction ? undefined : o.password);
  if (!adminPassword || !crewPassword || !operatorPassword) {
    throw new Error(
      "In production, define SEED_ADMIN_PASSWORD, SEED_CREW_PASSWORD, and SEED_OPERATOR_PASSWORD before running the seed."
    );
  }
  const [adminHash, crewHash, operatorHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(crewPassword, 10),
    bcrypt.hash(operatorPassword, 10),
  ]);
  const admin = await prisma.user.upsert({
    where: { email: a.email },
    update: { name: a.name, role: Role.ADMIN, passwordHash: adminHash, deletedAt: null },
    create: { id: a.id, email: a.email, name: a.name, passwordHash: adminHash, role: Role.ADMIN },
  });
  const commander = await prisma.user.upsert({
    where: { email: c.email },
    update: { name: c.name, role: Role.USER, passwordHash: crewHash, deletedAt: null },
    create: { id: c.id, email: c.email, name: c.name, passwordHash: crewHash, role: Role.USER },
  });
  const operator = await prisma.user.upsert({
    where: { email: o.email },
    update: { name: o.name, role: Role.OPERATOR, passwordHash: operatorHash, deletedAt: null },
    create: { id: o.id, email: o.email, name: o.name, passwordHash: operatorHash, role: Role.OPERATOR },
  });
  console.log("✅ Usuarios: admin (Flight Surgeon), tripulante (USER) y operador de tierra (OPERATOR) de demo.");

  const data = buildSeedData({ adminId: admin.id, commanderUserId: commander.id, operatorUserId: operator.id });

  // 2. Misiones (upsert por id)
  for (const { id, createdById, createdAt, ...rest } of data.missions) {
    await prisma.mission.upsert({
      where: { id: id! },
      update: rest,
      create: { id, createdById, createdAt, ...rest },
    });
  }
  console.log(`✅ ${data.missions.length} misiones.`);

  // 3. Tripulación (el usuario de demo se desvincula de cualquier otro astronauta)
  await prisma.astronaut.updateMany({
    where: { userId: commander.id, NOT: { id: COMMANDER_ASTRONAUT_ID } },
    data: { userId: null },
  });
  for (const { id, createdAt, ...rest } of data.astronauts) {
    await prisma.astronaut.upsert({ where: { id: id! }, update: rest, create: { id, createdAt, ...rest } });
  }
  console.log(`✅ ${data.astronauts.length} astronautas.`);

  // 4. Lecturas, incidentes y directivas
  await prisma.healthReading.createMany({ data: data.readings });
  console.log(`✅ ${data.readings.length} lecturas (${countBy(data.readings, (r) => (r.isValid === false ? "INVALIDADA" : String(r.status)))}).`);

  await prisma.incident.createMany({ data: data.incidents });
  console.log(`✅ ${data.incidents.length} incidentes (${countBy(data.incidents, (r) => String(r.status))}).`);

  await prisma.directive.createMany({ data: data.directives });
  console.log(`✅ ${data.directives.length} directivas.`);

  // 6. Políticas públicas de Supabase Storage (artemis-assets), si existe el esquema
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_select') THEN
            CREATE POLICY artemis_assets_public_select ON storage.objects FOR SELECT USING (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_insert') THEN
            CREATE POLICY artemis_assets_public_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_update') THEN
            CREATE POLICY artemis_assets_public_update ON storage.objects FOR UPDATE USING (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_delete') THEN
            CREATE POLICY artemis_assets_public_delete ON storage.objects FOR DELETE USING (bucket_id = 'artemis-assets');
          END IF;
        END IF;
      END
      $$;
    `);
  } catch {
    // PostgreSQL local sin el esquema storage de Supabase
  }

  console.log("🚀 Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
