import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { Device } from "@servicebook/schemas";
import { useDeviceQuery } from "@/lib/devices";
import { formatDate } from "@/lib/format";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type DeviceDrawerProps = {
  deviceId: string | null;
  onClose: () => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

export function DeviceDrawer({ deviceId, onClose, onEdit, onDelete }: DeviceDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: device, isError } = useDeviceQuery(deviceId);

  return (
    <Sheet open={deviceId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{device?.name ?? t("Device")}</SheetTitle>
          <SheetDescription>{t("Device details")}</SheetDescription>
        </SheetHeader>

        {isError ? (
          <p className="text-sm text-destructive">{t("Could not load the device.")}</p>
        ) : !device ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <dl className="space-y-4">
              <Detail label={t("Owner")}>
                {device.owner ? (
                  <>
                    <span className="font-medium">{device.owner.name}</span>
                    <br />
                    <a href={`tel:${device.owner.phone}`} className="text-primary hover:underline">
                      {device.owner.phone}
                    </a>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("Generic device")}</span>
                )}
              </Detail>
              <Detail label={t("Added on")}>{formatDate(device.createdAt, i18n.language)}</Detail>
            </dl>

            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => onEdit(device)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                {t("Edit")}
              </Button>
              <Button variant="outline" onClick={() => onDelete(device)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden />
                {t("Delete")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
