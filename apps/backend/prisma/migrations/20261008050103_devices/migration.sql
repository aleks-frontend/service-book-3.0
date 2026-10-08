-- CreateTable
CREATE TABLE "device" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" UUID,
    "legacyId" TEXT,
    "legacyIsNew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_legacyId_key" ON "device"("legacyId");

-- CreateIndex
CREATE INDEX "device_name_idx" ON "device"("name");

-- CreateIndex
CREATE INDEX "device_ownerId_idx" ON "device"("ownerId");

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
