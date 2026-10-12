import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { deviceLabel, type Customer } from "@servicebook/schemas";
import { useCustomerQuery, useDeleteCustomerMutation } from "@/lib/customers";
import { useDevicesQuery } from "@/lib/devices";
import { formatDate } from "@/lib/format";
import { useCustomerServicesQuery } from "@/lib/services";
import type { OpenDrawer } from "@/lib/useDrawerStack";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";
import { ServiceHistory } from "./ServiceHistory";

/** The most devices the drawer lists; the rest are counted. */
const DEVICES_SHOWN = 50;

type CustomerDrawerProps = {
  customerId: string | null;
  onClose: () => void;
  onOpen: OpenDrawer;
};

/** Facebook is stored as staff typed it: a profile URL or just a name. */
function facebookLink(facebook: string) {
  return /^https?:\/\//i.test(facebook) ? (
    <a href={facebook} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      {facebook}
    </a>
  ) : (
    facebook
  );
}

/** One customer, opened in the drawer stack as `?customer=<id>`. */
export function CustomerDrawer({ customerId, onClose, onOpen }: CustomerDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: customer, isError } = useCustomerQuery(customerId);
  const deleteCustomer = useDeleteCustomerMutation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function confirmDelete() {
    if (!customer) return;
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onClose();
      },
    });
  }

  return (
    <>
      <EntityDrawer
        open={customerId !== null}
        onClose={onClose}
        entity={customer}
        isError={isError}
        errorMessage={t("Could not load the customer.")}
        title={customer?.name ?? t("Customer")}
        description={
          customer
            ? t("Added on {{date}}", { date: formatDate(customer.createdAt, i18n.language) })
            : t("Customer details")
        }
        editLabel={t("Edit customer")}
        deleteLabel={t("Delete customer")}
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmingDelete(true)}
      >
        {(customer) => (
          <>
            <CustomerSummary customer={customer} />
            <CustomerDevices customerId={customer.id} onOpen={onOpen} />
            <CustomerServices customerId={customer.id} onOpen={onOpen} />
          </>
        )}
      </EntityDrawer>

      {customer && (
        <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={customer} />
      )}

      <ConfirmDeleteDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("Delete customer?")}
        description={t("{{name}} will be permanently deleted.", { name: customer?.name ?? "" })}
        isDeleting={deleteCustomer.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/** The contact details at a glance; they are changed in the edit modal. */
function CustomerSummary({ customer }: { customer: Customer }) {
  const { t } = useTranslation();

  return (
    <DrawerSummary label={t("Customer details")}>
      <DrawerSummaryRow label={t("Phone")}>
        <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
          {customer.phone}
        </a>
      </DrawerSummaryRow>
      {customer.email && (
        <DrawerSummaryRow label={t("Email")}>
          <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
            {customer.email}
          </a>
        </DrawerSummaryRow>
      )}
      {customer.address && (
        <DrawerSummaryRow label={t("Address")}>{customer.address}</DrawerSummaryRow>
      )}
      {customer.facebook && (
        <DrawerSummaryRow label={t("Facebook")}>{facebookLink(customer.facebook)}</DrawerSummaryRow>
      )}
    </DrawerSummary>
  );
}

/** The devices the customer owns, by name; each opens its own drawer. */
function CustomerDevices({ customerId, onOpen }: { customerId: string; onOpen: OpenDrawer }) {
  const { t } = useTranslation();
  const { data, isError } = useDevicesQuery({
    ownerId: customerId,
    page: 1,
    pageSize: DEVICES_SHOWN,
  });

  return (
    <section className="space-y-2" aria-label={t("Devices")}>
      <h3 className="text-sm font-semibold">
        {t("Devices")}
        {data && data.total > 0 && (
          <span className="ml-1.5 font-normal text-muted-foreground">({data.total})</span>
        )}
      </h3>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load devices.")}</p>
      ) : data === undefined ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : data.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("This customer owns no devices.")}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {data.items.map((device) => (
            <li key={device.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                onClick={() => onOpen("device", device.id)}
              >
                <span className="font-medium">{deviceLabel(device)}</span>
                {device.serialNumber && (
                  <span className="truncate text-muted-foreground">{device.serialNumber}</span>
                )}
              </button>
            </li>
          ))}
          {data.total > data.items.length && (
            <li className="px-3 py-2 text-muted-foreground">
              {t("and {{count}} more", { count: data.total - data.items.length })}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** The customer's services, newest first; each opens its own drawer. */
function CustomerServices({ customerId, onOpen }: { customerId: string; onOpen: OpenDrawer }) {
  const { t } = useTranslation();
  const { data, isError } = useCustomerServicesQuery(customerId);

  return (
    <ServiceHistory
      services={data}
      isError={isError}
      emptyMessage={t("This customer has no services yet.")}
      describe={(service) => service.devices.map(deviceLabel).join(", ")}
      onOpen={(service) => onOpen("service", service.id)}
    />
  );
}
