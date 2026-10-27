import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { CUSTOMER_REPORT_MAX, type ServiceDetail } from "@servicebook/schemas";
import { useSaveCustomerReportMutation } from "@/lib/services";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

type CompletionDialogProps = {
  /** The service just completed; the dialog is open while one is set. */
  service: ServiceDetail | undefined;
  /** Called when the dialog closes, after a save or by skipping or dismissing it. */
  onClose: () => void;
  /** Generates the service report from the service as saved; failures are reported by a toast. */
  onGenerate: (service: ServiceDetail) => void;
};

/**
 * Asks for the customer report once a service is completed: it saves the report, then
 * generates the service report from it. Skipping or dismissing it saves nothing.
 */
export function CompletionDialog({ service, onClose, onGenerate }: CompletionDialogProps) {
  // The parent clears the service as soon as the dialog closes; keep showing the
  // last one so the text doesn't go blank while the dialog animates out. Each new
  // offer starts a fresh form, even for the same service completed again.
  const [shown, setShown] = useState({ service, offerCount: 0 });
  if (service && service !== shown.service) setShown({ service, offerCount: shown.offerCount + 1 });

  if (!shown.service) return null;
  return (
    <CompletionForm
      key={shown.offerCount}
      service={shown.service}
      open={!!service}
      onClose={onClose}
      onGenerate={onGenerate}
    />
  );
}

/** How the dialog finishes: saving, then generating the service report or not. */
type Finish = "generate" | "save";

type CompletionFormProps = Omit<CompletionDialogProps, "service"> & {
  service: ServiceDetail;
  open: boolean;
};

function CompletionForm({ service, open, onClose, onGenerate }: CompletionFormProps) {
  const { t } = useTranslation();
  const save = useSaveCustomerReportMutation(service.id);
  const prefill = service.customerReport ?? "";
  const [customerReport, setCustomerReport] = useState(prefill);
  // Which button is saving, to show its spinner.
  const [finishing, setFinishing] = useState<Finish>();

  async function finish(action: Finish) {
    if (finishing) return;
    setFinishing(action);
    let saved = service;
    if (customerReport !== prefill) {
      try {
        saved = await save.mutateAsync(customerReport);
      } catch {
        // The mutation's onError already reports the failure; the text stays for a retry.
        setFinishing(undefined);
        return;
      }
    }
    // From the service as saved, so the report carries the text the server kept (trimmed).
    if (action === "generate") onGenerate(saved);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !finishing && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("Service {{number}} is completed", { number: service.number })}
          </DialogTitle>
          <DialogDescription>
            {t("What was done, as the customer reads it on the service report.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="completion-customer-report" className="text-sm font-medium">
            {t("Customer report")}
          </label>
          <Textarea
            id="completion-customer-report"
            rows={8}
            maxLength={CUSTOMER_REPORT_MAX}
            value={customerReport}
            onChange={(event) => setCustomerReport(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void finish("generate");
              }
            }}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={!!finishing} onClick={onClose}>
            {t("Skip")}
          </Button>
          <Button variant="outline" disabled={!!finishing} onClick={() => void finish("save")}>
            {finishing === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("Save only")}
          </Button>
          <Button disabled={!!finishing} onClick={() => void finish("generate")}>
            {finishing === "generate" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            {t("Save and generate the service report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
