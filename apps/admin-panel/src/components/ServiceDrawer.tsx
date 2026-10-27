import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Copy, Loader2, Printer } from "lucide-react";
import { deviceLabel, type ServiceDetail } from "@servicebook/schemas";
import { useDownloadIntakeReceiptMutation } from "@/lib/intakeReceipt";
import { useDownloadServiceReportMutation } from "@/lib/serviceReport";
import { useDeleteServiceMutation, useServiceQuery } from "@/lib/services";
import { formatDate, formatPlainDate } from "@/lib/format";
import { publicServiceUrl } from "@/lib/publicServices";
import { cn } from "@/lib/utils";
import type { OpenDrawer } from "@/lib/useDrawerStack";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CustomerReport } from "./CustomerReport";
import {
  DrawerLink,
  DrawerSummary,
  DrawerSummaryRow,
  EntityDrawer,
  type DrawerPlace,
} from "./EntityDrawer";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLines } from "./ServiceLines";
import { ServiceLog } from "./ServiceLog";
import { ServicePhotos } from "./ServicePhotos";
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
  place: DrawerPlace;
  onOpen: OpenDrawer;
};

/** One service, opened in the drawer stack as `?service=<id>`. */
export function ServiceDrawer({ serviceId, place, onOpen }: ServiceDrawerProps) {
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
        place.onClose();
      },
    });
  }

  return (
    <>
      <EntityDrawer
        open={serviceId !== null}
        {...place}
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
            <ServicePhotos serviceId={service.id} />
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

/** The customer, devices, date, description and public link at a glance; the first four are changed in the edit modal. */
function ServiceSummary({ service, onOpen }: { service: ServiceDetail; onOpen: OpenDrawer }) {
  const { t, i18n } = useTranslation();

  return (
    <DrawerSummary label={t("Service details")}>
      <DrawerSummaryRow label={t("Customer")}>
        <DrawerLink onClick={() => onOpen("customer", service.customer.id)}>
          {service.customer.name}
        </DrawerLink>
        {" · "}
        <a href={`tel:${service.customer.phone}`} className="text-link">
          {service.customer.phone}
        </a>
      </DrawerSummaryRow>
      <DrawerSummaryRow label={t("Devices")}>
        {service.devices.length === 0
          ? "—"
          : service.devices.map((device, index) => (
              <Fragment key={device.id}>
                {index > 0 && ", "}
                <DrawerLink onClick={() => onOpen("device", device.id)}>
                  {deviceLabel(device)}
                </DrawerLink>
              </Fragment>
            ))}
      </DrawerSummaryRow>
      <DrawerSummaryRow label={t("Date")}>
        {formatPlainDate(service.date, i18n.language)}
      </DrawerSummaryRow>
      {service.description && (
        <DrawerSummaryRow label={t("Description")}>
          <span className="whitespace-pre-line">{service.description}</span>
        </DrawerSummaryRow>
      )}
      <DrawerSummaryRow label={t("Public link")}>
        <PublicLink publicToken={service.publicToken} />
      </DrawerSummaryRow>
    </DrawerSummary>
  );
}

/** The page the customer sees, to open in a new tab or copy to the clipboard. */
function PublicLink({ publicToken }: { publicToken: string }) {
  const { t } = useTranslation();
  const url = publicServiceUrl(publicToken);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("Public link copied"));
    } catch {
      toast.error(t("Could not copy the public link."));
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 break-all text-link"
      >
        {url}
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="-my-1 h-7 w-7 shrink-0"
        aria-label={t("Copy public link")}
        title={t("Copy public link")}
        onClick={copy}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </span>
  );
}
