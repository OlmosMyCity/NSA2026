import { PrismaClient, Role, Environment, MissionStatus, CrewLocation } from "@prisma/client";
import bcrypt from "bcrypt";
import { evaluateReading, type HealthReadingInput } from "../src/application/health/evaluateReading.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de la base de datos Artemis IV Crew Health...");

  // 1. Limpieza de datos en orden inverso de dependencias para evitar colisiones
  await prisma.healthReading.deleteMany();
  await prisma.astronaut.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.user.deleteMany();

  // 2. Usuarios del sistema (contraseñas hasheadas con bcrypt)
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash("HrpFlight#2026", saltRounds);
  const userPasswordHash = await bcrypt.hash("OrionCrew#4IV", saltRounds);

  const adminUser = await prisma.user.create({
    data: {
      email: "elena.rodriguez@nasa.gov",
      name: "Dra. Elena Rodriguez",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const commanderUser = await prisma.user.create({
    data: {
      email: "r.wiseman@nasa.gov",
      name: "Reid Wiseman",
      passwordHash: userPasswordHash,
      role: Role.USER,
    },
  });

  const operatorUser = await prisma.user.create({
    data: {
      email: "ops@orbvital.example",
      name: "Mission Operations",
      passwordHash: await bcrypt.hash("GroundOps#2026", saltRounds),
      role: Role.OPERATOR,
    },
  });

  console.log("✅ Usuarios creados: Admin (Flight Surgeon), User (Comandante) y Operator (Tierra).");

  // 3. Misión principal Artemis IV
  const missionStartDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // Hace 14 días

  const mission = await prisma.mission.create({
    data: {
      name: "Artemis IV — Lunar South Pole Expedition",
      description:
        "Misión tripulada de larga duración con SLS Block 1B, estancia en Gateway (NRHO) y alunizaje en el polo sur lunar (86.8° S) para exploración científica y monitoreo fisiológico en baja gravedad.",
      environment: Environment.LUNAR_BASE,
      status: MissionStatus.IN_PROGRESS,
      startDate: missionStartDate,
      patchUrl: null,
      createdById: adminUser.id,
      operatorId: operatorUser.id,
    },
  });

  console.log(`✅ Misión creada: ${mission.name}`);

  // 4. Tripulación de 4 astronautas
  const crewData = [
    {
      name: "Reid Wiseman",
      role: "Comandante de Misión",
      age: 49,
      userId: commanderUser.id,
      photoUrl: null,
    },
    {
      name: "Victor Glover",
      role: "Piloto",
      age: 48,
      userId: null,
      photoUrl: null,
    },
    {
      name: "Christina Koch",
      role: "Especialista de Misión (Ciencia)",
      age: 46,
      userId: null,
      photoUrl: null,
    },
    {
      name: "Jeremy Hansen",
      role: "Especialista de Misión (Sistemas)",
      age: 49,
      userId: null,
      photoUrl: null,
    },
  ];

  const astronauts = [];
  for (const c of crewData) {
    const astro = await prisma.astronaut.create({
      data: {
        missionId: mission.id,
        userId: c.userId,
        name: c.name,
        role: c.role,
        age: c.age,
        photoUrl: c.photoUrl,
        currentLocation: CrewLocation.HABITAT,
        locationUpdatedAt: new Date(),
      },
    });
    astronauts.push(astro);
  }

  console.log(`✅ 4 Astronautas registrados en la misión.`);

  // 5. 14 Días de Lecturas de Salud con Telemetría Realista y Anomalías
  let totalReadings = 0;

  for (const astro of astronauts) {
    for (let day = 14; day >= 1; day--) {
      const takenAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);

      // Valores nominales base con pequeña variabilidad fisiológica
      let rawMetrics: HealthReadingInput = {
        heartRateBpm: 68 + Math.floor(Math.random() * 12),
        systolicMmHg: 116 + Math.floor(Math.random() * 8),
        diastolicMmHg: 76 + Math.floor(Math.random() * 6),
        glucoseMgDl: 92 + Math.floor(Math.random() * 20),
        temperatureC: Number((36.5 + Math.random() * 0.4).toFixed(1)),
        spo2Pct: Number((97 + Math.random() * 2).toFixed(1)),
        sleepHours: Number((7.0 + Math.random() * 1.2).toFixed(1)),
        mood: 4 + (Math.random() > 0.5 ? 1 : 0),
      };

      let notes = `Monitoreo matutino rutinario en hábitat presurizado. Día ${15 - day} de misión.`;

      // Simular evento de caminata espacial (EVA) en el Día 5 (hace 9 días) para el Comandante y Especialista
      if (day === 9 && (astro.name === "Reid Wiseman" || astro.name === "Christina Koch")) {
        rawMetrics = {
          ...rawMetrics,
          heartRateBpm: 104, // Taquicardia por esfuerzo EVA
          systolicMmHg: 136, // Presión limítrofe
          sleepHours: 5.8, // Fatiga post-EVA
          mood: 3,
        };
        notes = "Reporte post-actividad extravehicular (EVA) en cráter Shackleton. Esfuerzo muscular prolongado.";
      }

      // Simular un leve desbalance de ventilación en el Día 10 (hace 4 días) para el Piloto
      if (day === 4 && astro.name === "Victor Glover") {
        rawMetrics = {
          ...rawMetrics,
          spo2Pct: 93.0, // Warning leve
          headacheWarning: true,
          mood: 3,
        } as HealthReadingInput;
        notes = "Reporta leve cefalea matutina tras guardia de madrugada; ventilador de recirculación revisado.";
      }

      // Evaluar clínicamente usando la regla pura de la NASA
      const evaluation = evaluateReading(rawMetrics);

      await prisma.healthReading.create({
        data: {
          astronautId: astro.id,
          heartRateBpm: rawMetrics.heartRateBpm,
          systolicMmHg: rawMetrics.systolicMmHg,
          diastolicMmHg: rawMetrics.diastolicMmHg,
          glucoseMgDl: rawMetrics.glucoseMgDl,
          temperatureC: rawMetrics.temperatureC,
          spo2Pct: rawMetrics.spo2Pct,
          sleepHours: rawMetrics.sleepHours,
          mood: rawMetrics.mood,
          status: evaluation.status,
          alerts: evaluation.alerts as object,
          recommendation: evaluation.recommendation,
          notes,
          takenAt,
        },
      });

      totalReadings++;
    }
  }

  console.log(`✅ ${totalReadings} lecturas clínicas de salud registradas y evaluadas.`);

  // 6. Garantizar políticas públicas de lectura/escritura en Supabase Storage (artemis-assets)
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
    // Ignorar en motores PostgreSQL locales sin esquema storage de Supabase
  }

  console.log("🚀 Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

