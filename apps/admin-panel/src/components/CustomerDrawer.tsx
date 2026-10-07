import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { Customer } from "@servicebook/schemas";
import { useCustomerQuery } from "@/lib/customers";
import { formatDate } from "@/lib/format";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type CustomerDrawerProps = {
  customerId: string | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children ?? "—"}</dd>
    </div>
  );
}

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
    <Sheet open={customerId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{customer?.name ?? t("Customer")}</SheetTitle>
          <SheetDescription>{t("Customer details")}</SheetDescription>
        </SheetHeader>

        {isError ? (
          <p className="text-sm text-destructive">{t("Could not load the customer.")}</p>
        ) : !customer ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <dl className="space-y-4">
              <Detail label={t("Phone")}>
                <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                  {customer.phone}
                </a>
              </Detail>
              <Detail label={t("Email")}>
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                    {customer.email}
                  </a>
                )}
              </Detail>
              <Detail label={t("Address")}>{customer.address}</Detail>
              <Detail label={t("Facebook")}>
                {customer.facebook && facebookLink(customer.facebook)}
              </Detail>
              <Detail label={t("Added on")}>{formatDate(customer.createdAt, i18n.language)}</Detail>
            </dl>

            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => onEdit(customer)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                {t("Edit")}
              </Button>
              <Button variant="outline" onClick={() => onDelete(customer)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden />
                {t("Delete")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
