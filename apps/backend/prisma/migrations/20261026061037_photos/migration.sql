-- CreateTable
CREATE TABLE "photo" (
    "id" UUID NOT NULL,
    "logEntryId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "thumbnailKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photo_logEntryId_position_key" ON "photo"("logEntryId", "position");

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "service_log_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A note may now have only photos, so its text may be null. Whether a note has
-- text or at least one photo is checked by the routes: a check constraint can't
-- see the photo table. A legacy remark is still text only.
ALTER TABLE "service_log_entry" DROP CONSTRAINT "service_log_entry_type_fields_check";
ALTER TABLE "service_log_entry" ADD CONSTRAINT "service_log_entry_type_fields_check" CHECK (
  ("type" = 'STATUS_CHANGE' AND "text" IS NULL AND "fromStatus" IS NOT NULL AND "toStatus" IS NOT NULL)
  OR ("type" = 'NOTE' AND "fromStatus" IS NULL AND "toStatus" IS NULL)
  OR ("type" = 'LEGACY_REMARK' AND "text" IS NOT NULL AND "fromStatus" IS NULL AND "toStatus" IS NULL)
);
