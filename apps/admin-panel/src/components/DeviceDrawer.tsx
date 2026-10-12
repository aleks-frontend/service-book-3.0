import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deviceLabel, type Device } from "@servicebook/schemas";
import { useDeleteDeviceMutation, useDeviceQuery } from "@/lib/devices";
import { formatDate } from "@/lib/format";
import { useDeviceServicesQuery } from "@/lib/services";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";
import { ServiceHistory } from "./ServiceHistory";

type DeviceDrawerProps = {
  deviceId: string | null;
  onClose: () => void;
  onOpenService: (serviceId: string) => void;
};

/** One device, opened from the `?device=<id>` URL param on any page. */
export function DeviceDrawer({ deviceId, onClose, onOpenService }: DeviceDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: device, isError } = useDeviceQuery(deviceId);
  const deleteDevice = useDeleteDeviceMutation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function confirmDelete() {
    if (!device) return;
    deleteDevice.mutate(device.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onClose();
      },
    });
  }

  return (
    <>
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
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmingDelete(true)}
      >
        {(device) => (
          <>
            <DeviceSummary device={device} />
            <DeviceServices deviceId={device.id} onOpen={onOpenService} />
          </>
        )}
      </EntityDrawer>

      {device && <DeviceFormDialog open={editing} onOpenChange={setEditing} device={device} />}

      <ConfirmDeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("Delete device?")}
        description={t("{{name}} will be permanently deleted.", {
          name: device ? deviceLabel(device) : "",
        })}
        isDeleting={deleteDevice.isPending}
        onConfirm={confirmDelete}
      />
    </>
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

/**
 * Every service the device was attached to or sold on, newest first; each
 * opens its own drawer. A generic device's services can be anyone's.
 */
function DeviceServices({
  deviceId,
  onOpen,
}: {
  deviceId: string;
  onOpen: (serviceId: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isError } = useDeviceServicesQuery(deviceId);

  return (
    <ServiceHistory
      services={data}
      isError={isError}
      emptyMessage={t("This device has not been on a service yet.")}
      describe={(service) => (
        <>
          {service.customer.name}
          {service.sold && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              {t("Sold")}
            </span>
          )}
        </>
      )}
      onOpen={(service) => onOpen(service.id)}
    />
  );
}
