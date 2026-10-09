import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { useDeleteServiceMutation, useSaveServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ServiceForm } from "./ServiceForm";
import { ServiceLines } from "./ServiceLines";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type ServiceDrawerProps = {
  serviceId: string | null;
  onClose: () => void;
};

/** One service, opened from the `?service=<id>` URL param. */
export function ServiceDrawer({ serviceId, onClose }: ServiceDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: service, isError } = useServiceQuery(serviceId);
  const saveService = useSaveServiceMutation();
  const deleteService = useDeleteServiceMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function confirmDelete() {
    if (!service) return;
    deleteService.mutate(service.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onClose();
      },
    });
  }

  return (
    <Sheet open={serviceId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="tabular-nums">
              {service ? t("Service {{number}}", { number: service.number }) : t("Service")}
            </span>
            {service && <StatusBadge status={service.status} />}
          </SheetTitle>
          <SheetDescription>
            {service
              ? t("Registered on {{date}}", {
                  date: formatDate(service.createdAt, i18n.language),
                })
              : t("Service details")}
          </SheetDescription>
        </SheetHeader>

        {isError ? (
          <p className="text-sm text-destructive">{t("Could not load the service.")}</p>
        ) : !service ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">{t("Details")}</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4">
              <ServiceForm
                id="service-details-form"
                service={service}
                onSubmit={(input) => saveService.mutate({ id: service.id, input })}
              />
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="submit" form="service-details-form" disabled={saveService.isPending}>
                  {saveService.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Save changes")}
                </Button>
                <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden />
                  {t("Delete")}
                </Button>
              </div>
              <div className="border-t pt-4">
                <ServiceLines service={service} />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <ConfirmDeleteDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={t("Delete service?")}
          description={t("Service {{number}} will be permanently deleted.", {
            number: service?.number ?? "",
          })}
          isDeleting={deleteService.isPending}
          onConfirm={confirmDelete}
        />
      </SheetContent>
    </Sheet>
  );
}
