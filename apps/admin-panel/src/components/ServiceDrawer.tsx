import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deviceLabel, type ServiceDetail } from "@servicebook/schemas";
import { useDeleteServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate, formatPlainDate } from "@/lib/format";
import type { OpenDrawer } from "@/lib/useDrawerStack";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { DrawerLink, DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLines } from "./ServiceLines";
import { ServiceLog } from "./ServiceLog";
import { StatusSelect } from "./StatusSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type ServiceDrawerProps = {
  serviceId: string | null;
  onClose: () => void;
  onOpen: OpenDrawer;
};

/** One service, opened in the drawer stack as `?service=<id>`. */
export function ServiceDrawer({ serviceId, onClose, onOpen }: ServiceDrawerProps) {
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
    <>
      <EntityDrawer
        open={serviceId !== null}
        onClose={onClose}
        entity={service}
        isError={isError}
        errorMessage={t("Could not load the service.")}
        title={
          <span className="tabular-nums">
            {service ? t("Service {{number}}", { number: service.number }) : t("Service")}
          </span>
        }
        description={
          service
            ? t("Registered on {{date}}", { date: formatDate(service.createdAt, i18n.language) })
            : t("Service details")
        }
        editLabel={t("Edit service")}
        deleteLabel={t("Delete service")}
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmingDelete(true)}
        actions={(service) => <StatusSelect serviceId={service.id} status={service.status} />}
      >
        {(service) => (
          <>
            <ServiceSummary service={service} onOpen={onOpen} />
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
          </>
        )}
      </EntityDrawer>

      {service && <ServiceFormDialog open={editing} onOpenChange={setEditing} service={service} />}

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
    </>
  );
}

/** The customer, devices, date and description at a glance; they are changed in the edit modal. */
function ServiceSummary({ service, onOpen }: { service: ServiceDetail; onOpen: OpenDrawer }) {
  const { t, i18n } = useTranslation();

  return (
    <DrawerSummary label={t("Service details")}>
      <DrawerSummaryRow label={t("Customer")}>
        <DrawerLink onClick={() => onOpen("customer", service.customer.id)}>
          {service.customer.name}
        </DrawerLink>
        {" · "}
        <a href={`tel:${service.customer.phone}`} className="text-primary hover:underline">
          {service.customer.phone}
        </a>
      </DrawerSummaryRow>
      <DrawerSummaryRow label={t("Devices")}>
        {service.devices.map(deviceLabel).join(", ") || "—"}
      </DrawerSummaryRow>
      <DrawerSummaryRow label={t("Date")}>
        {formatPlainDate(service.date, i18n.language)}
      </DrawerSummaryRow>
      {service.description && (
        <DrawerSummaryRow label={t("Description")}>
          <span className="whitespace-pre-line">{service.description}</span>
        </DrawerSummaryRow>
      )}
    </DrawerSummary>
  );
}
