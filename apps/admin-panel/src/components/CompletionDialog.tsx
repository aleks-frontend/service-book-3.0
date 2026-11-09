import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { CUSTOMER_REPORT_MAX, type ServiceDetail } from "@servicebook/schemas";
import { cn } from "@/lib/utils";
import {
  polishCustomerReport,
  useSaveCustomerReportMutation,
  useServiceLogQuery,
} from "@/lib/services";
import { useAiPolish } from "@/lib/useAiPolish";
import { PolishButton, PolishedBar } from "./AiPolish";
import { LogEntryByline } from "./ServiceLog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
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
 * generates the service report from it. Skipping or dismissing it saves nothing. AI
 * polish can tidy the draft, as in the Customer report tab.
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
  // Whether generating with an empty report has been warned about; generating again proceeds.
  const [warned, setWarned] = useState(false);
  const isEmpty = customerReport.trim() === "";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const polish = useAiPolish({
    request: (text) => polishCustomerReport(service.id, text),
    textareaRef,
    text: customerReport,
    setText: setCustomerReport,
  });
  // Nothing finishes, and the dialog doesn't close, while a polish is in flight.
  const isBusy = !!finishing || polish.isPolishing;

  async function finish(action: Finish) {
    if (isBusy) return;
    if (action === "generate" && isEmpty && !warned) {
      setWarned(true);
      return;
    }
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
    // No `polish.reset()`: the dialog closes, and the next offer starts a fresh form.
    // From the service as saved, so the report carries the text the server kept (trimmed).
    if (action === "generate") onGenerate(saved);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isBusy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("Service {{number}} is completed", { number: service.number })}
          </DialogTitle>
          <DialogDescription>
            {t("What was done, as the customer reads it on the service report.")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="completion-customer-report" className="text-sm font-medium">
              {t("Customer report")}
            </label>
            <Textarea
              ref={textareaRef}
              id="completion-customer-report"
              rows={8}
              maxLength={CUSTOMER_REPORT_MAX}
              // Read-only rather than disabled, so the text stays readable while it is polished.
              readOnly={polish.isPolishing}
              value={customerReport}
              onChange={(event) => {
                setCustomerReport(event.target.value);
                polish.onEdit();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void finish("generate");
                }
              }}
            />
            <PolishedBar polish={polish} />
            {warned && isEmpty && (
              // Yellow marks what needs action (ADR-0005): an edge, since it is never text.
              <p
                role="alert"
                className="flex items-start gap-2 border-l-4 border-primary bg-muted px-3 py-2 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t("The service report will go out without a customer report.")}
              </p>
            )}
            {/* Under the text rather than in the footer, which already holds three actions. */}
            <PolishButton polish={polish} disabled={!!finishing} />
          </div>
          <StaffNotes serviceId={service.id} />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={isBusy} onClick={onClose}>
            {t("Skip")}
          </Button>
          <Button variant="outline" disabled={isBusy} onClick={() => void finish("save")}>
            {finishing === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("Save only")}
          </Button>
          <Button disabled={isBusy} onClick={() => void finish("generate")}>
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

/**
 * The log's staff notes, read-only and collapsed at first, to write the customer report
 * from. Status changes, imported remarks and photos are left out; nothing is copied.
 */
function StaffNotes({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data: entries, isError } = useServiceLogQuery(serviceId);
  const notes = entries?.filter((entry) => entry.type === "NOTE");
  const contentId = useId();

  return (
    <section className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={cn("mr-1 h-4 w-4 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
        {t("Notes from the work log")}
      </Button>
      <div id={contentId} hidden={!expanded} className="max-h-48 overflow-y-auto">
        {isError ? (
          <p className="text-sm text-destructive">{t("Could not load the log.")}</p>
        ) : !notes ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No notes in the work log yet.")}</p>
        ) : (
          <ol className="space-y-3 border-l-2 pl-3">
            {notes.map((note) => (
              <li key={note.id} className="space-y-1 text-sm" data-testid="staff-note">
                <LogEntryByline entry={note} />
                {note.text ? (
                  <p className="whitespace-pre-line">{note.text}</p>
                ) : (
                  <p className="text-muted-foreground">{t("Photos only")}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
