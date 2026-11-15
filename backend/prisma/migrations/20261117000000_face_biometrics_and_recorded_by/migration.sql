-- AlterTable: trazabilidad de quién registró la lectura (compañero de misión o ADMIN)
ALTER TABLE "health_readings" ADD COLUMN "recordedById" TEXT;

-- CreateIndex
CREATE INDEX "health_readings_recordedById_idx" ON "health_readings"("recordedById");

-- AddForeignKey
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: muestras biométricas faciales por tripulante
CREATE TABLE "astronaut_face_samples" (
    "id" TEXT NOT NULL,
    "astronautId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "label" TEXT,
    "embedding" JSONB NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astronaut_face_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "astronaut_face_samples_astronautId_idx" ON "astronaut_face_samples"("astronautId");

-- AddForeignKey
ALTER TABLE "astronaut_face_samples" ADD CONSTRAINT "astronaut_face_samples_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astronaut_face_samples" ADD CONSTRAINT "astronaut_face_samples_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
