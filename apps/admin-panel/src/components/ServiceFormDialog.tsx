import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { Service } from "@servicebook/schemas";
import { useSaveServiceMutation } from "@/lib/services";
import { ServiceForm } from "./ServiceForm";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type ServiceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The service to edit; omitted when registering a new one. */
  service?: Service;
};

/**
 * The "Add" modal, which registers a new service (it starts as Received), and
 * the drawer's "Edit service" modal for its customer, devices, date and description.
 */
export function ServiceFormDialog({ open, onOpenChange, service }: ServiceFormDialogProps) {
  const { t } = useTranslation();
  const saveService = useSaveServiceMutation();
  const formId = service ? "service-edit-form" : "service-create-form";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{service ? t("Edit service") : t("New service")}</DialogTitle>
          <DialogDescription>{t("Fields marked with * are required.")}</DialogDescription>
        </DialogHeader>

        <ServiceForm
          id={formId}
          service={service}
          onSubmit={(input) =>
            saveService.mutate({ id: service?.id, input }, { onSuccess: () => onOpenChange(false) })
          }
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saveService.isPending}>
            {saveService.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {service ? t("Save changes") : t("Create service")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
