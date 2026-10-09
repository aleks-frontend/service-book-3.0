import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  serviceInputSchema,
  type CustomerSummary,
  type Service,
  type DeviceSummary,
  type ServiceInput,
  type ServiceInputValues,
} from "@servicebook/schemas";
import { todayPlainDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomerPicker } from "./CustomerPicker";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { DevicePicker } from "./DevicePicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type ServiceFormProps = {
  /** The form element's id, so a submit button outside it can target it. */
  id: string;
  /** The service to edit; omitted when creating one. */
  service?: Service;
  onSubmit: (input: ServiceInput) => void;
};

/**
 * The customer, devices, date and description of a service. The customer and
 * devices can be picked or created inline; the date starts as today.
 */
export function ServiceForm({ id, service, onSubmit }: ServiceFormProps) {
  const { t } = useTranslation();

  // The form only holds ids; the pickers also need the names to show.
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<ServiceInputValues, unknown, ServiceInput>({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input.
    resolver: zodResolver(serviceInputSchema) as Resolver<
      ServiceInputValues,
      unknown,
      ServiceInput
    >,
  });

  useEffect(() => {
    reset({
      customerId: service?.customer.id ?? "",
      deviceIds: service?.devices.map((device) => device.id) ?? [],
      description: service?.description ?? "",
      date: service?.date ?? todayPlainDate(),
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
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => setCreatingCustomer(true)}
            >
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
              onClick={() => setCreatingDevice(true)}
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
                id={`${id}-devices`}
                customerId={customer?.id ?? null}
                value={devices}
                onChange={changeDevices}
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
      </form>

      {/* Outside the form: a nested dialog's submit would otherwise bubble up to it through the React tree. */}
      <CustomerFormDialog
        open={creatingCustomer}
        onOpenChange={setCreatingCustomer}
        onSaved={({ id, name, phone }) => changeCustomer({ id, name, phone })}
      />
      <DeviceFormDialog
        open={creatingDevice}
        onOpenChange={setCreatingDevice}
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
