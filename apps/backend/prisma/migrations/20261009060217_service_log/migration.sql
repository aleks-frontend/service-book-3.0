-- CreateEnum
CREATE TYPE "LogEntryType" AS ENUM ('NOTE', 'STATUS_CHANGE', 'LEGACY_REMARK');

-- CreateTable
CREATE TABLE "service_log_entry" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "type" "LogEntryType" NOT NULL,
    "text" TEXT,
    "fromStatus" "Status",
    "toStatus" "Status",
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_log_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_log_entry_serviceId_createdAt_idx" ON "service_log_entry"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "service_log_entry_authorId_idx" ON "service_log_entry"("authorId");

-- AddForeignKey
ALTER TABLE "service_log_entry" ADD CONSTRAINT "service_log_entry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_log_entry" ADD CONSTRAINT "service_log_entry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A status change records where it went from and to and carries no text; a note
-- or legacy remark is text only.
ALTER TABLE "service_log_entry" ADD CONSTRAINT "service_log_entry_type_fields_check" CHECK (
  ("type" = 'STATUS_CHANGE' AND "text" IS NULL AND "fromStatus" IS NOT NULL AND "toStatus" IS NOT NULL)
  OR ("type" <> 'STATUS_CHANGE' AND "text" IS NOT NULL AND "fromStatus" IS NULL AND "toStatus" IS NULL)
);
