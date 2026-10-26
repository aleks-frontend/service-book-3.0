import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  LOG_NOTE_MAX,
  serviceCreateInputSchema,
  serviceInputSchema,
  type CustomerSummary,
  type Service,
  type DeviceSummary,
  type ServiceCreateInput,
  type ServiceCreateInputValues,
} from "@servicebook/schemas";
import { todayPlainDate } from "@/lib/format";
import type { PhotoPickerState } from "@/lib/usePhotoPicker";
import { cn } from "@/lib/utils";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomerPicker } from "./CustomerPicker";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { DevicePicker } from "./DevicePicker";
import { PhotoPicker } from "./PhotoPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type ServiceFormProps = {
  /** The form element's id, so a submit button outside it can target it. */
  id: string;
  /** The service to edit; omitted when creating one. */
  service?: Service;
  /**
   * The intake note's photos, held by the caller so they outlive a failed
   * save. Given when creating a service only, which adds the optional
   * "Condition at intake" section: a note and its photos.
   */
  intakeNotePhotos?: PhotoPickerState;
  /** Whether the service is being saved, which locks the intake photos. */
  saving?: boolean;
  /** The service's fields; `intakeNote` is set when creating only. */
  onSubmit: (input: ServiceCreateInput) => void;
};

/**
 * The customer, devices, date and description of a service, and, when one is
 * created, an optional note and photos of the device's condition at intake.
 * The customer and devices can be picked or created inline; the date starts as today.
 */
export function ServiceForm({ id, service, intakeNotePhotos, saving, onSubmit }: ServiceFormProps) {
  const { t } = useTranslation();

  // The form only holds ids; the pickers also need the names to show.
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  // The name the new customer starts with; null while its dialog is closed.
  const [newCustomerName, setNewCustomerName] = useState<string | null>(null);
  // The model the new device starts with; null while its dialog is closed.
  const [newDeviceModel, setNewDeviceModel] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<ServiceCreateInputValues, unknown, ServiceCreateInput>({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input. An edit has no intake note to submit.
    resolver: zodResolver(service ? serviceInputSchema : serviceCreateInputSchema) as Resolver<
      ServiceCreateInputValues,
      unknown,
      ServiceCreateInput
    >,
  });

  useEffect(() => {
    reset({
      customerId: service?.customer.id ?? "",
      deviceIds: service?.devices.map((device) => device.id) ?? [],
      description: service?.description ?? "",
      date: service?.date ?? todayPlainDate(),
      intakeNote: "",
    });
    setCustomer(service?.customer ?? null);
    setDevices(service?.devices ?? []);
  }, [service, reset]);

  function changeCustomer(next: CustomerSummary | null) {
    setCustomer(next);
    setValue("customerId", next?.id ?? "", { shouldValidate: isSubmitted });
    // Another customer cannot bring in the previous customer's devices.
    changeDevices(devices.filter((device) => !device.owner || device.owner.id === next?.id));
  }

  function changeDevices(next: DeviceSummary[]) {
    setDevices(next);
    setValue(
      "deviceIds",
      next.map((device) => device.id),
      { shouldValidate: isSubmitted },
    );
  }

  return (
    <>
      <form
        id={id}
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        autoComplete="off"
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${id}-customer`} className="text-sm font-medium">
              {t("Customer")} *
            </label>
            <Button type="button" variant="link" size="xs" onClick={() => setNewCustomerName("")}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t("New customer")}
            </Button>
          </div>
          <Controller
            control={control}
            name="customerId"
            render={() => (
              <CustomerPicker
                id={`${id}-customer`}
                value={customer}
                onChange={changeCustomer}
                onCreate={setNewCustomerName}
                placeholder={t("Search customers")}
                invalid={!!errors.customerId}
              />
            )}
          />
          {errors.customerId && (
            <p className="text-sm text-destructive">{t("Choose a customer")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${id}-devices`} className="text-sm font-medium">
              {t("Devices")} *
            </label>
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => setNewDeviceModel("")}
              disabled={!customer}
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t("New device")}
            </Button>
          </div>
          <Controller
            control={control}
            name="deviceIds"
            render={() => (
              <DevicePicker
                multiple
                id={`${id}-devices`}
                customerId={customer?.id ?? null}
                value={devices}
                onChange={changeDevices}
                onCreate={setNewDeviceModel}
                placeholder={
                  customer ? t("The customer's or generic devices") : t("Choose a customer first")
                }
                invalid={!!errors.deviceIds}
                disabled={!customer}
              />
            )}
          />
          {errors.deviceIds && (
            <p className="text-sm text-destructive">{t("Attach at least one device")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-date`} className="text-sm font-medium">
            {t("Date")} *
          </label>
          <Input
            id={`${id}-date`}
            type="date"
            aria-invalid={!!errors.date}
            className={cn(
              "w-auto",
              errors.date && "border-destructive focus-visible:ring-destructive",
            )}
            {...register("date")}
          />
          {errors.date && <p className="text-sm text-destructive">{t("Enter a date")}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-description`} className="text-sm font-medium">
            {t("Description")}
          </label>
          <Textarea id={`${id}-description`} rows={4} {...register("description")} />
        </div>

        {intakeNotePhotos && (
          <fieldset className="space-y-1.5 border-t pt-4">
            <legend className="float-left mb-1.5 w-full text-sm font-medium">
              {t("Condition at intake")}
            </legend>
            <label htmlFor={`${id}-intake-note`} className="sr-only">
              {t("Intake note")}
            </label>
            <Textarea
              id={`${id}-intake-note`}
              rows={3}
              maxLength={LOG_NOTE_MAX}
              placeholder={t("Scratches, cracks, dents… Saved as the first note in the log.")}
              {...register("intakeNote")}
            />
            <PhotoPicker id={`${id}-intake-photos`} picker={intakeNotePhotos} disabled={saving} />
          </fieldset>
        )}
      </form>

      {/* Outside the form: a nested dialog's submit would otherwise bubble up to it through the React tree. */}
      <CustomerFormDialog
        open={newCustomerName !== null}
        onOpenChange={(open) => !open && setNewCustomerName(null)}
        defaultName={newCustomerName ?? undefined}
        onSaved={({ id, name, phone }) => changeCustomer({ id, name, phone })}
      />
      <DeviceFormDialog
        open={newDeviceModel !== null}
        onOpenChange={(open) => !open && setNewDeviceModel(null)}
        defaultModel={newDeviceModel ?? undefined}
        defaultOwner={customer}
        onSaved={({ id, manufacturer, model, serialNumber, owner }) => {
          // The owner may have been changed to someone else in the dialog.
          if (owner && owner.id !== customer?.id) return;
          changeDevices([...devices, { id, manufacturer, model, serialNumber, owner }]);
        }}
      />
    </>
  );
}
