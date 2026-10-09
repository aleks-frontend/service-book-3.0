import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deviceLabel, type ServiceDetail } from "@servicebook/schemas";
import { useDeleteServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate, formatPlainDate } from "@/lib/format";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLines } from "./ServiceLines";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type ServiceDrawerProps = {
  serviceId: string | null;
  onClose: () => void;
};

/** One service, opened from the `?service=<id>` URL param. */
export function ServiceDrawer({ serviceId, onClose }: ServiceDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: service, isError } = useServiceQuery(serviceId);
  const deleteService = useDeleteServiceMutation();
  const [editing, setEditing] = useState(false);
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
          <>
            <ServiceSummary
              service={service}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
            <ServiceLines service={service} />
            <ServiceFormDialog open={editing} onOpenChange={setEditing} service={service} />
          </>
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

type ServiceSummaryProps = {
  service: ServiceDetail;
  onEdit: () => void;
  onDelete: () => void;
};

/** The customer, devices, date and description at a glance; they are changed in the edit modal. */
function ServiceSummary({ service, onEdit, onDelete }: ServiceSummaryProps) {
  const { t, i18n } = useTranslation();

  return (
    <section
      className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm"
      aria-label={t("Service details")}
    >
      <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{t("Customer")}</dt>
        <dd>
          <span className="font-medium">{service.customer.name}</span>
          {" · "}
          <a href={`tel:${service.customer.phone}`} className="text-primary hover:underline">
            {service.customer.phone}
          </a>
        </dd>
        <dt className="text-muted-foreground">{t("Devices")}</dt>
        <dd>{service.devices.map(deviceLabel).join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">{t("Date")}</dt>
        <dd>{formatPlainDate(service.date, i18n.language)}</dd>
        {service.description && (
          <>
            <dt className="text-muted-foreground">{t("Description")}</dt>
            <dd className="whitespace-pre-line">{service.description}</dd>
          </>
        )}
      </dl>
      <div className="flex shrink-0 gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("Edit service")}
          title={t("Edit service")}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("Delete service")}
          title={t("Delete service")}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
