-- Whether the shop sold a device is derived from the sale lines that refer to
-- it, so the old app's flag is not stored. The import reads it only to route
-- each legacy reference to a sale line or an attached device.
ALTER TABLE "device" DROP COLUMN "isNewDevice";
