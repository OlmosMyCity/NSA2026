-- Baseline (P7): esquema tal como estaba antes de adoptar Prisma Migrate.
-- En una base existente NO se ejecuta: se marca como aplicada con
--   npx prisma migrate resolve --applied 20261101000000_baseline

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserState" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('SPACECRAFT', 'STATION', 'ROVER', 'LUNAR_BASE', 'MARS_BASE');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('OK', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('MEDICAL', 'RADIATION', 'MISSION');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "state" "UserState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'LUNAR_BASE',
    "status" "MissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "patchUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astronauts" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "astronauts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_readings" (
    "id" TEXT NOT NULL,
    "astronautId" TEXT NOT NULL,
    "heartRateBpm" INTEGER NOT NULL,
    "systolicMmHg" INTEGER NOT NULL,
    "diastolicMmHg" INTEGER NOT NULL,
    "glucoseMgDl" DOUBLE PRECISION NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "spo2Pct" DOUBLE PRECISION NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL,
    "mood" INTEGER NOT NULL,
    "status" "HealthStatus" NOT NULL DEFAULT 'OK',
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "recommendation" TEXT,
    "notes" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "health_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "astronautId" TEXT,
    "missionId" TEXT,
    "source" TEXT NOT NULL,
    "readingId" TEXT,
    "protocolId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directives" (
    "id" TEXT NOT NULL,
    "astronautId" TEXT NOT NULL,
    "issuedById" TEXT,
    "incidentId" TEXT,
    "content" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "astronauts_userId_key" ON "astronauts"("userId");

-- CreateIndex
CREATE INDEX "health_readings_astronautId_takenAt_idx" ON "health_readings"("astronautId", "takenAt");

-- CreateIndex
CREATE INDEX "incidents_status_type_astronautId_idx" ON "incidents"("status", "type", "astronautId");

-- CreateIndex
CREATE INDEX "incidents_astronautId_openedAt_idx" ON "incidents"("astronautId", "openedAt");

-- CreateIndex
CREATE INDEX "directives_astronautId_createdAt_idx" ON "directives"("astronautId", "createdAt");

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astronauts" ADD CONSTRAINT "astronauts_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astronauts" ADD CONSTRAINT "astronauts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

