import { useTranslation } from "react-i18next";
import { deviceLabel, type Device } from "@servicebook/schemas";
import { useDeviceQuery } from "@/lib/devices";
import { formatDate } from "@/lib/format";
import { DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";

type DeviceDrawerProps = {
  deviceId: string | null;
  onClose: () => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
};

export function DeviceDrawer({ deviceId, onClose, onEdit, onDelete }: DeviceDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: device, isError } = useDeviceQuery(deviceId);

  return (
    <EntityDrawer
      open={deviceId !== null}
      onClose={onClose}
      entity={device}
      isError={isError}
      errorMessage={t("Could not load the device.")}
      title={device ? deviceLabel(device) : t("Device")}
      description={
        device
          ? t("Added on {{date}}", { date: formatDate(device.createdAt, i18n.language) })
          : t("Device details")
      }
      editLabel={t("Edit device")}
      deleteLabel={t("Delete device")}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      {(device) => <DeviceSummary device={device} />}
    </EntityDrawer>
  );
}

/** The device and its owner at a glance; they are changed in the edit modal. */
function DeviceSummary({ device }: { device: Device }) {
  const { t } = useTranslation();

  return (
    <DrawerSummary label={t("Device details")}>
      {device.manufacturer && (
        <DrawerSummaryRow label={t("Manufacturer")}>{device.manufacturer}</DrawerSummaryRow>
      )}
      <DrawerSummaryRow label={t("Model")}>{device.model}</DrawerSummaryRow>
      {device.serialNumber && (
        <DrawerSummaryRow label={t("Serial number")}>{device.serialNumber}</DrawerSummaryRow>
      )}
      {device.description && (
        <DrawerSummaryRow label={t("Description")}>
          <span className="whitespace-pre-line">{device.description}</span>
        </DrawerSummaryRow>
      )}
      <DrawerSummaryRow label={t("Owner")}>
        {device.owner ? (
          <>
            <span className="font-medium">{device.owner.name}</span>
            {" · "}
            <a href={`tel:${device.owner.phone}`} className="text-primary hover:underline">
              {device.owner.phone}
            </a>
          </>
        ) : (
          <span className="text-muted-foreground">{t("Generic device")}</span>
        )}
      </DrawerSummaryRow>
    </DrawerSummary>
  );
}
