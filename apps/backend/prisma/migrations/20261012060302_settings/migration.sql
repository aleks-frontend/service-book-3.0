-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxId" TEXT,
    "logo" BYTEA,
    "logoType" TEXT,
    "signature" BYTEA,
    "signatureType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- Settings is a singleton: its one row always has id 1.
ALTER TABLE "settings" ADD CONSTRAINT "settings_singleton_check" CHECK ("id" = 1);

-- An image and its media type are set or cleared together.
ALTER TABLE "settings" ADD CONSTRAINT "settings_image_type_check" CHECK (
  ("logo" IS NULL) = ("logoType" IS NULL)
  AND ("signature" IS NULL) = ("signatureType" IS NULL)
);
