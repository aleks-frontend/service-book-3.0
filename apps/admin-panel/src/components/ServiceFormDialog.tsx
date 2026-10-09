import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
};

/** The "Add" modal: registers a new service, which starts as Received. */
export function ServiceFormDialog({ open, onOpenChange }: ServiceFormDialogProps) {
  const { t } = useTranslation();
  const saveService = useSaveServiceMutation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{t("New service")}</DialogTitle>
          <DialogDescription>{t("Fields marked with * are required.")}</DialogDescription>
        </DialogHeader>

        <ServiceForm
          id="service-create-form"
          onSubmit={(input) =>
            saveService.mutate({ input }, { onSuccess: () => onOpenChange(false) })
          }
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="service-create-form" disabled={saveService.isPending}>
            {saveService.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Create service")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
