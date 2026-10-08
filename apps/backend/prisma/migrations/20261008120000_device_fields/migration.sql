-- A device is now described by manufacturer and model instead of a free-form
-- name. Existing names become models, so no device is left without one.
DROP INDEX "device_name_idx";
ALTER TABLE "device" RENAME COLUMN "name" TO "model";
ALTER TABLE "device" RENAME COLUMN "legacyIsNew" TO "isNewDevice";
ALTER TABLE "device" ADD COLUMN "manufacturer" TEXT,
ADD COLUMN "serialNumber" TEXT,
ADD COLUMN "description" TEXT;

-- CreateIndex
CREATE INDEX "device_manufacturer_model_idx" ON "device"("manufacturer", "model");
