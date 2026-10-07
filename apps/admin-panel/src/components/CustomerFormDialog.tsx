import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  customerInputSchema,
  type Customer,
  type CustomerInput,
  type CustomerInputValues,
} from "@servicebook/schemas";
import { useSaveCustomerMutation } from "@/lib/customers";
import { cn } from "@/lib/utils";
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

type CustomerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer to edit; omitted when creating one. */
  customer?: Customer;
};

const FIELDS = [
  { name: "name", label: "Name", required: true, error: "Enter a name", autoComplete: "name" },
  {
    name: "phone",
    label: "Phone",
    required: true,
    error: "Enter a phone number",
    type: "tel",
    autoComplete: "tel",
  },
  {
    name: "email",
    label: "Email",
    error: "Enter a valid email address",
    type: "email",
    autoComplete: "email",
  },
  { name: "address", label: "Address", autoComplete: "street-address" },
  { name: "facebook", label: "Facebook" },
] as const satisfies readonly {
  name: keyof CustomerInputValues;
  label: string;
  required?: boolean;
  error?: string;
  type?: string;
  autoComplete?: string;
}[];

function toFormValues(customer?: Customer): CustomerInputValues {
  return {
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    facebook: customer?.facebook ?? "",
  };
}

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const { t } = useTranslation();
  const saveCustomer = useSaveCustomerMutation();
  const isEdit = customer !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerInputValues, unknown, CustomerInput>({
    // zodResolver submits the schema's parsed output (blank optional fields
    // as null), but @hookform/resolvers v3 only types it as the input.
    resolver: zodResolver(customerInputSchema) as Resolver<
      CustomerInputValues,
      unknown,
      CustomerInput
    >,
  });

  useEffect(() => {
    if (open) reset(toFormValues(customer));
  }, [open, customer, reset]);

  function onSubmit(input: CustomerInput) {
    saveCustomer.mutate({ id: customer?.id, input }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>{isEdit ? t("Edit customer") : t("New customer")}</DialogTitle>
          <DialogDescription>{t("Fields marked with * are required.")}</DialogDescription>
        </DialogHeader>

        <form
          id="customer-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          autoComplete="off"
          className="space-y-4"
        >
          {FIELDS.map((field) => {
            const error = errors[field.name];
            const id = `customer-${field.name}`;
            return (
              <div key={field.name} className="space-y-1.5">
                <label htmlFor={id} className="text-sm font-medium">
                  {t(field.label)}
                  {"required" in field && " *"}
                </label>
                <Input
                  id={id}
                  type={"type" in field ? field.type : "text"}
                  autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                  aria-invalid={!!error}
                  className={cn(error && "border-destructive focus-visible:ring-destructive")}
                  {...register(field.name)}
                />
                {error && "error" in field && (
                  <p className="text-sm text-destructive">{t(field.error)}</p>
                )}
              </div>
            );
          })}
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="customer-form" disabled={saveCustomer.isPending}>
            {saveCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? t("Save changes") : t("Create customer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
