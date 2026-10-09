import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { deviceLabel, type ServiceDetail } from "@servicebook/schemas";
import { useDeleteServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate, formatPlainDate } from "@/lib/format";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLines } from "./ServiceLines";
import { ServiceLog } from "./ServiceLog";
import { StatusSelect } from "./StatusSelect";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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
      <SheetContent className="gap-0 p-0 sm:max-w-xl" showClose={false}>
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center bg-primary/10 px-4">
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">{t("Close")}</span>
            </Button>
          </SheetClose>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* The status, edit and delete buttons are for the whole service. */}
          <SheetHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-0">
            <div className="space-y-1.5">
              <SheetTitle className="tabular-nums">
                {service ? t("Service {{number}}", { number: service.number }) : t("Service")}
              </SheetTitle>
              <SheetDescription>
                {service
                  ? t("Registered on {{date}}", {
                      date: formatDate(service.createdAt, i18n.language),
                    })
                  : t("Service details")}
              </SheetDescription>
            </div>
            {service && (
              <div className="flex shrink-0 items-center gap-2">
                <StatusSelect serviceId={service.id} status={service.status} />
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("Edit service")}
                  title={t("Edit service")}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("Delete service")}
                  title={t("Delete service")}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              </div>
            )}
          </SheetHeader>

          {isError ? (
            <p className="text-sm text-destructive">{t("Could not load the service.")}</p>
          ) : !service ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ServiceSummary service={service} />
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">{t("Details")}</TabsTrigger>
                  <TabsTrigger value="log">{t("Log")}</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <ServiceLines service={service} />
                </TabsContent>
                <TabsContent value="log">
                  <ServiceLog serviceId={service.id} />
                </TabsContent>
              </Tabs>
              <ServiceFormDialog open={editing} onOpenChange={setEditing} service={service} />
            </>
          )}
        </div>

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

/** The customer, devices, date and description at a glance; they are changed in the edit modal. */
function ServiceSummary({ service }: { service: ServiceDetail }) {
  const { t, i18n } = useTranslation();

  return (
    <section
      className="rounded-md border bg-muted/30 p-3 text-sm"
      aria-label={t("Service details")}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
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
    </section>
  );
}
