import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { CUSTOMER_REPORT_MAX, type ServiceDetail } from "@servicebook/schemas";
import { useSaveCustomerReportMutation } from "@/lib/services";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type CustomerReportValues = { customerReport: string };

/**
 * The final customer-facing text of what was done, printed on the service
 * report. Ctrl+Enter (⌘+Enter) saves it too.
 */
export function CustomerReport({ service }: { service: ServiceDetail }) {
  const { t } = useTranslation();
  const save = useSaveCustomerReportMutation(service.id);
  const { register, handleSubmit, formState } = useForm<CustomerReportValues>({
    // Follows the saved report, so it shows what the server kept (trimmed) after a save.
    values: { customerReport: service.customerReport ?? "" },
  });
  const canSave = formState.isDirty && !save.isPending;

  const submit = handleSubmit(({ customerReport }) => {
    if (!save.isPending) save.mutate(customerReport);
  });

  return (
    <form className="space-y-2" onSubmit={submit}>
      <label htmlFor="customer-report" className="text-sm font-medium">
        {t("Customer report")}
      </label>
      <p className="text-sm text-muted-foreground">
        {t("What was done, as the customer reads it on the service report.")}
      </p>
      <Textarea
        id="customer-report"
        rows={8}
        maxLength={CUSTOMER_REPORT_MAX}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        {...register("customerReport")}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSave}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {t("Save changes")}
        </Button>
      </div>
    </form>
  );
}
