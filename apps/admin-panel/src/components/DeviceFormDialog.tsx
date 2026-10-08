import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  deviceInputSchema,
  type Device,
  type DeviceInput,
  type DeviceInputValues,
  type CustomerSummary,
} from "@servicebook/schemas";
import { useSaveDeviceMutation } from "@/lib/devices";
import { cn } from "@/lib/utils";
import { CustomerPicker } from "./CustomerPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type DeviceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The device to edit; omitted when creating one. */
  device?: Device;
};

export function DeviceFormDialog({ open, onOpenChange, device }: DeviceFormDialogProps) {
  const { t } = useTranslation();
  const saveDevice = useSaveDeviceMutation();
  const isEdit = device !== undefined;

  // The form only holds the owner's id; the picker also needs the name to show.
  const [owner, setOwner] = useState<CustomerSummary | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeviceInputValues, unknown, DeviceInput>({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input.
    resolver: zodResolver(deviceInputSchema) as Resolver<DeviceInputValues, unknown, DeviceInput>,
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: device?.name ?? "", ownerId: device?.owner?.id ?? null });
    setOwner(device?.owner ?? null);
  }, [open, device, reset]);

  function onSubmit(input: DeviceInput) {
    saveDevice.mutate({ id: device?.id, input }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>{isEdit ? t("Edit device") : t("New device")}</DialogTitle>
          <DialogDescription>{t("Fields marked with * are required.")}</DialogDescription>
        </DialogHeader>

        <form
          id="device-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          autoComplete="off"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="device-name" className="text-sm font-medium">
              {t("Name", { context: "device" })} *
            </label>
            <Input
              id="device-name"
              aria-invalid={!!errors.name}
              className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{t("Enter a name")}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="device-owner" className="text-sm font-medium">
              {t("Owner")}
            </label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <CustomerPicker
                  id="device-owner"
                  value={owner}
                  onChange={(customer) => {
                    setOwner(customer);
                    field.onChange(customer?.id ?? null);
                  }}
                  placeholder={t("Search customers")}
                  invalid={!!errors.ownerId}
                />
              )}
            />
            <p className="text-sm text-muted-foreground">
              {t("Leave empty for a generic device.")}
            </p>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="device-form" disabled={saveDevice.isPending}>
            {saveDevice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? t("Save changes") : t("Create device")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
