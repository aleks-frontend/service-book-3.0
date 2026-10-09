-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('WORK', 'SALE');

-- CreateTable
CREATE TABLE "service_line" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "type" "LineType" NOT NULL,
    "actionId" UUID,
    "deviceId" UUID,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_line_serviceId_position_idx" ON "service_line"("serviceId", "position");

-- CreateIndex
CREATE INDEX "service_line_actionId_idx" ON "service_line"("actionId");

-- CreateIndex
CREATE INDEX "service_line_deviceId_idx" ON "service_line"("deviceId");

-- AddForeignKey
ALTER TABLE "service_line" ADD CONSTRAINT "service_line_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_line" ADD CONSTRAINT "service_line_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_line" ADD CONSTRAINT "service_line_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A work line never refers to a device, nor a sale line to an action (ADR-0004).
-- The reference itself stays optional, for legacy lines whose action or device is gone.
ALTER TABLE "service_line" ADD CONSTRAINT "service_line_type_reference_check" CHECK (
  ("type" = 'WORK' AND "deviceId" IS NULL) OR ("type" = 'SALE' AND "actionId" IS NULL)
);
