import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Printer } from "lucide-react";
import { deviceLabel, type ServiceDetail } from "@servicebook/schemas";
import { useDownloadIntakeReceiptMutation } from "@/lib/intakeReceipt";
import { useDownloadServiceReportMutation } from "@/lib/serviceReport";
import { useDeleteServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate, formatPlainDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OpenDrawer } from "@/lib/useDrawerStack";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CustomerReport } from "./CustomerReport";
import { DrawerLink, DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLines } from "./ServiceLines";
import { ServiceLog } from "./ServiceLog";
import { StatusSelect } from "./StatusSelect";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
        actions={(service) => (
          <>
            <StatusSelect serviceId={service.id} status={service.status} />
            <PrintMenu service={service} />
          </>
        )}
      >
        {(service) => (
          <>
            <ServiceSummary service={service} onOpen={onOpen} />
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">{t("Details")}</TabsTrigger>
                <TabsTrigger value="customer-report">{t("Customer report")}</TabsTrigger>
                <TabsTrigger value="log">{t("Log")}</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <ServiceLines service={service} />
              </TabsContent>
              <TabsContent value="customer-report">
                <CustomerReport service={service} />
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

/** Downloads one of the service's documents: the intake receipt or the service report. */
function PrintMenu({ service }: { service: ServiceDetail }) {
  const { t } = useTranslation();
  const intakeReceipt = useDownloadIntakeReceiptMutation();
  const serviceReport = useDownloadServiceReportMutation();
  const isPending = intakeReceipt.isPending || serviceReport.isPending;
  const Icon = isPending ? Loader2 : Printer;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("Print")}
          title={t("Print")}
          disabled={isPending}
        >
          <Icon className={cn("h-4 w-4", isPending && "animate-spin")} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => intakeReceipt.mutate(service)}>
          {t("Intake receipt")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => serviceReport.mutate(service)}>
          {t("Service report")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
