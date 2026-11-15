-- P1 / P5 / P6: datos de salud inmutables (solo se agregan), rangos físicamente
-- posibles en la base y sin borrado físico de lecturas.
--
-- 1. Columnas de invalidación y corrección (generado por Prisma)
-- DropForeignKey
ALTER TABLE "health_readings" DROP CONSTRAINT "health_readings_astronautId_fkey";

-- AlterTable
ALTER TABLE "health_readings" ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidatedById" TEXT,
ADD COLUMN     "invalidatedReason" TEXT,
ADD COLUMN     "isValid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supersedesId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "health_readings_supersedesId_key" ON "health_readings"("supersedesId");

-- CreateIndex
CREATE INDEX "health_readings_astronautId_isValid_takenAt_idx" ON "health_readings"("astronautId", "isValid", "takenAt");

-- CreateIndex
CREATE INDEX "health_readings_invalidatedById_idx" ON "health_readings"("invalidatedById");

-- AddForeignKey
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_astronautId_fkey" FOREIGN KEY ("astronautId") REFERENCES "astronauts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "health_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 2. Las lecturas que antes se "borraban" con deletedAt pasan a estar invalidadas
UPDATE "health_readings"
SET "isValid" = false,
    "invalidatedAt" = "deletedAt",
    "invalidatedReason" = 'Migrado desde borrado lógico (deletedAt)'
WHERE "deletedAt" IS NOT NULL;

-- 3. P5: rangos FÍSICAMENTE posibles (los mismos que valida Zod en la API).
--    Los rangos clínicos (qué es peligroso) los decide evaluateReading, nunca la base.
--    NOT VALID aplica la regla a filas nuevas; luego se intenta validar las existentes.
ALTER TABLE "health_readings"
  ADD CONSTRAINT "health_readings_heart_rate_bpm_possible"  CHECK ("heartRateBpm"  BETWEEN 20 AND 260) NOT VALID,
  ADD CONSTRAINT "health_readings_systolic_mmhg_possible"   CHECK ("systolicMmHg"  BETWEEN 40 AND 300) NOT VALID,
  ADD CONSTRAINT "health_readings_diastolic_mmhg_possible"  CHECK ("diastolicMmHg" BETWEEN 20 AND 200) NOT VALID,
  ADD CONSTRAINT "health_readings_glucose_mg_dl_possible"   CHECK ("glucoseMgDl"   BETWEEN 15 AND 1000) NOT VALID,
  ADD CONSTRAINT "health_readings_temperature_c_possible"   CHECK ("temperatureC"  BETWEEN 25 AND 45) NOT VALID,
  ADD CONSTRAINT "health_readings_spo2_pct_possible"        CHECK ("spo2Pct"       BETWEEN 30 AND 100) NOT VALID,
  ADD CONSTRAINT "health_readings_sleep_hours_possible"     CHECK ("sleepHours"    BETWEEN 0 AND 24) NOT VALID,
  ADD CONSTRAINT "health_readings_mood_possible"            CHECK ("mood"          BETWEEN 1 AND 5) NOT VALID,
  ADD CONSTRAINT "health_readings_invalidation_complete"
    CHECK ("isValid" OR ("invalidatedAt" IS NOT NULL AND "invalidatedReason" IS NOT NULL)) NOT VALID;

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'health_readings'::regclass AND contype = 'c' AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE "health_readings" VALIDATE CONSTRAINT %I', c);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'Hay filas antiguas que no cumplen %; la regla aplica solo a filas nuevas.', c;
    END;
  END LOOP;
END $$;

-- 4. P1 + P6 en la base: health_readings es solo de agregado.
--    - DELETE prohibido.
--    - UPDATE solo para invalidar (isValid true → false con motivo); los valores clínicos no cambian.
--    - Escape explícito para seeds/mantenimiento: SET LOCAL orbvital.allow_health_purge = 'on'
CREATE OR REPLACE FUNCTION "health_readings_append_only"() RETURNS trigger AS $$
BEGIN
  IF current_setting('orbvital.allow_health_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'health_readings es solo de agregado: no se permite DELETE (lectura %). Invalídela en su lugar.', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF (NEW."id", NEW."astronautId", NEW."heartRateBpm", NEW."systolicMmHg", NEW."diastolicMmHg",
      NEW."glucoseMgDl", NEW."temperatureC", NEW."spo2Pct", NEW."sleepHours", NEW."mood",
      NEW."status", NEW."alerts", NEW."recommendation", NEW."notes", NEW."takenAt",
      NEW."createdAt", NEW."deletedAt", NEW."supersedesId")
     IS DISTINCT FROM
     (OLD."id", OLD."astronautId", OLD."heartRateBpm", OLD."systolicMmHg", OLD."diastolicMmHg",
      OLD."glucoseMgDl", OLD."temperatureC", OLD."spo2Pct", OLD."sleepHours", OLD."mood",
      OLD."status", OLD."alerts", OLD."recommendation", OLD."notes", OLD."takenAt",
      OLD."createdAt", OLD."deletedAt", OLD."supersedesId") THEN
    RAISE EXCEPTION 'health_readings es solo de agregado: los valores de la lectura % no se pueden editar. Registre una corrección.', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NOT OLD."isValid" AND (NEW."isValid" OR NEW."invalidatedAt" IS DISTINCT FROM OLD."invalidatedAt"
      OR NEW."invalidatedReason" IS DISTINCT FROM OLD."invalidatedReason"
      OR NEW."invalidatedById" IS DISTINCT FROM OLD."invalidatedById") THEN
    RAISE EXCEPTION 'La lectura % ya está invalidada; la invalidación es definitiva.', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "health_readings_append_only" ON "health_readings";
CREATE TRIGGER "health_readings_append_only"
  BEFORE UPDATE OR DELETE ON "health_readings"
  FOR EACH ROW EXECUTE FUNCTION "health_readings_append_only"();
