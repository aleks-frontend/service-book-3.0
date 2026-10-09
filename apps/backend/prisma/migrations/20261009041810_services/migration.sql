-- CreateEnum
CREATE TYPE "Status" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "publicToken" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'RECEIVED',
    "customerId" UUID NOT NULL,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_device" (
    "serviceId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "service_device_pkey" PRIMARY KEY ("serviceId","deviceId")
);

-- CreateTable
CREATE TABLE "service_number_counter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "service_number_counter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_publicToken_key" ON "service"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "service_legacyId_key" ON "service"("legacyId");

-- CreateIndex
CREATE INDEX "service_date_year_sequence_idx" ON "service"("date", "year", "sequence");

-- CreateIndex
CREATE INDEX "service_customerId_idx" ON "service"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "service_year_sequence_key" ON "service"("year", "sequence");

-- CreateIndex
CREATE INDEX "service_device_deviceId_idx" ON "service_device"("deviceId");

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_device" ADD CONSTRAINT "service_device_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_device" ADD CONSTRAINT "service_device_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
