import { useTranslation } from "react-i18next";
import type { Customer } from "@servicebook/schemas";
import { useCustomerQuery } from "@/lib/customers";
import { formatDate } from "@/lib/format";
import { DrawerSummary, DrawerSummaryRow, EntityDrawer } from "./EntityDrawer";

type CustomerDrawerProps = {
  customerId: string | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
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

export function CustomerDrawer({ customerId, onClose, onEdit, onDelete }: CustomerDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data: customer, isError } = useCustomerQuery(customerId);

  return (
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
      onEdit={onEdit}
      onDelete={onDelete}
    >
      {(customer) => <CustomerSummary customer={customer} />}
    </EntityDrawer>
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
