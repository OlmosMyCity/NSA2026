-- Rol de supervisión desde Tierra (OPERATOR), operador por misión y ubicación del tripulante.
-- Solo agrega: no modifica ni borra tablas, columnas ni filas existentes.

-- CreateEnum
CREATE TYPE "CrewLocation" AS ENUM ('CREW_CABIN', 'HABITAT', 'ROVER', 'EVA', 'STORM_SHELTER', 'MEDICAL_BAY');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OPERATOR';

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "operatorId" TEXT;

-- AlterTable
ALTER TABLE "astronauts" ADD COLUMN     "currentLocation" "CrewLocation",
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "missions_operatorId_idx" ON "missions"("operatorId");

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

