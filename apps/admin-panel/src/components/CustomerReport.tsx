import { useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { CUSTOMER_REPORT_MAX, type ServiceDetail } from "@servicebook/schemas";
import { polishCustomerReport, useSaveCustomerReportMutation } from "@/lib/services";
import { useAiPolish } from "@/lib/useAiPolish";
import { PolishButton, PolishedBar } from "./AiPolish";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type CustomerReportValues = { customerReport: string };

/**
 * The final customer-facing text of what was done, printed on the service
 * report. Ctrl+Enter (⌘+Enter) saves it too, and AI polish can tidy the draft.
 */
export function CustomerReport({ service }: { service: ServiceDetail }) {
  const { t } = useTranslation();
  const save = useSaveCustomerReportMutation(service.id);
  const { register, handleSubmit, formState, watch, setValue } = useForm<CustomerReportValues>({
    // Follows the saved report, so it shows what the server kept (trimmed) after a save.
    values: { customerReport: service.customerReport ?? "" },
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const polish = useAiPolish({
    request: (text) => polishCustomerReport(service.id, text),
    textareaRef,
    text: watch("customerReport"),
    setText: (text) => setValue("customerReport", text, { shouldDirty: true }),
  });
  const field = register("customerReport", { onChange: polish.onEdit });
  const canSave = formState.isDirty && !save.isPending && !polish.isPolishing;

  const submit = handleSubmit(({ customerReport }) => {
    if (save.isPending || polish.isPolishing) return;
    save.mutate(customerReport, { onSuccess: polish.reset });
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
        // Read-only rather than disabled, so the text stays readable while it is polished.
        readOnly={polish.isPolishing}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        {...field}
        ref={(textarea) => {
          field.ref(textarea);
          textareaRef.current = textarea;
        }}
      />
      <PolishedBar polish={polish} />
      <div className="flex items-center gap-2">
        <PolishButton polish={polish} disabled={save.isPending} />
        <Button type="submit" size="sm" className="ml-auto" disabled={!canSave}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {t("Save changes")}
        </Button>
      </div>
    </form>
  );
}
