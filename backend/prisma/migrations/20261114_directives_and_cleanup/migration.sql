-- Fase 2: Directivas clínicas separadas de HealthReading y limpieza de lecturas ficticias (72 lpm, 118/76)

CREATE TABLE IF NOT EXISTS "directives" (
  "id" TEXT NOT NULL,
  "astronautId" TEXT NOT NULL,
  "issuedById" TEXT,
  "incidentId" TEXT,
  "content" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "directives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "directives_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "directives_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "directives_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "directives_astronautId_createdAt_idx" ON "directives"("astronautId", "createdAt");

-- Migrar directivas existentes escritas en recommendation hacia la tabla directives
INSERT INTO "directives" ("id", "astronautId", "content", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  hr."astronautId",
  REGEXP_REPLACE(hr."recommendation", '^\[DIRECTIVA MÉDICA EN VIGOR\]:\s*', ''),
  hr."updatedAt",
  NOW()
FROM "health_readings" hr
WHERE hr."deletedAt" IS NULL
  AND hr."recommendation" LIKE '[DIRECTIVA MÉDICA EN VIGOR]:%';

-- Marcar (soft-delete) las lecturas ficticias generadas por sendClinicalDirectives (72 lpm, 118/76)
UPDATE "health_readings"
SET "deletedAt" = NOW(),
    "updatedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND "heartRateBpm" = 72
  AND "systolicMmHg" = 118
  AND "diastolicMmHg" = 76
  AND (
    "notes" = 'Lectura base generada al recibir directiva del Cirujano de Vuelo.'
    OR "recommendation" LIKE '[DIRECTIVA MÉDICA EN VIGOR]:%'
  );
