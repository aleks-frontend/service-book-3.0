import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import {
  deviceInputSchema,
  type Device,
  type DeviceInput,
  type DeviceInputValues,
  type CustomerSummary,
} from "@servicebook/schemas";
import { useSaveDeviceMutation } from "@/lib/devices";
import { cn } from "@/lib/utils";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomerPicker } from "./CustomerPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
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
  /** The owner a new device starts with, e.g. the customer of the service it is created for. */
  defaultOwner?: CustomerSummary | null;
  /** The model a new device starts with, e.g. what was searched for in a picker. */
  defaultModel?: string;
  /** Called with the saved device, e.g. to attach a device created inline. */
  onSaved?: (device: Device) => void;
};

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  defaultOwner = null,
  defaultModel,
  onSaved,
}: DeviceFormDialogProps) {
  const { t } = useTranslation();
  const saveDevice = useSaveDeviceMutation();
  const isEdit = device !== undefined;

  // The form only holds the owner's id; the picker also needs the name to show.
  const [owner, setOwner] = useState<CustomerSummary | null>(null);
  // The name the new owner starts with; null while their dialog is closed.
  const [newOwnerName, setNewOwnerName] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<DeviceInputValues, unknown, DeviceInput>({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input.
    resolver: zodResolver(deviceInputSchema) as Resolver<DeviceInputValues, unknown, DeviceInput>,
  });

  useEffect(() => {
    if (!open) return;
    reset({
      manufacturer: device?.manufacturer ?? "",
      model: device?.model ?? defaultModel ?? "",
      serialNumber: device?.serialNumber ?? "",
      description: device?.description ?? "",
      ownerId: device ? (device.owner?.id ?? null) : (defaultOwner?.id ?? null),
    });
    setOwner(device ? device.owner : defaultOwner);
  }, [open, device, defaultOwner, defaultModel, reset]);

  function changeOwner(next: CustomerSummary | null) {
    setOwner(next);
    setValue("ownerId", next?.id ?? null);
  }

  function onSubmit(input: DeviceInput) {
    saveDevice.mutate(
      { id: device?.id, input },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          // The search may hold the manufacturer too, so it is selected for moving or retyping.
          if (!defaultModel) return;
          event.preventDefault();
          setFocus("model", { shouldSelect: true });
        }}
      >
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
            <label htmlFor="device-manufacturer" className="text-sm font-medium">
              {t("Manufacturer")}
            </label>
            <Input id="device-manufacturer" {...register("manufacturer")} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="device-model" className="text-sm font-medium">
              {t("Model")} *
            </label>
            <Input
              id="device-model"
              aria-invalid={!!errors.model}
              className={cn(errors.model && "border-destructive focus-visible:ring-destructive")}
              {...register("model")}
            />
            {errors.model && <p className="text-sm text-destructive">{t("Enter a model")}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="device-serial-number" className="text-sm font-medium">
              {t("Serial number")}
            </label>
            <Input id="device-serial-number" {...register("serialNumber")} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="device-description" className="text-sm font-medium">
              {t("Description")}
            </label>
            <Textarea id="device-description" rows={3} {...register("description")} />
            <p className="text-sm text-muted-foreground">
              {t("Facts about the device itself, e.g. colour or capacity.")}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="device-owner" className="text-sm font-medium">
                {t("Owner")}
              </label>
              <Button type="button" variant="link" size="xs" onClick={() => setNewOwnerName("")}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("New customer")}
              </Button>
            </div>
            <Controller
              control={control}
              name="ownerId"
              render={() => (
                <CustomerPicker
                  id="device-owner"
                  value={owner}
                  onChange={changeOwner}
                  onCreate={setNewOwnerName}
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

        {/* Outside the form: a nested dialog's submit would otherwise bubble up to it through the React tree. */}
        <CustomerFormDialog
          open={newOwnerName !== null}
          onOpenChange={(open) => !open && setNewOwnerName(null)}
          defaultName={newOwnerName ?? undefined}
          onSaved={({ id, name, phone }) => changeOwner({ id, name, phone })}
        />

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
