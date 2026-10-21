import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ServiceDetail } from "@servicebook/schemas";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type OfferDocumentDialogProps = {
  /** The service whose document is offered; the dialog is open while one is set. */
  service: ServiceDetail | undefined;
  /** Called when the dialog closes, by either button or by dismissing it. */
  onClose: () => void;
  title: string;
  /** The question, e.g. "Service 2026-0001 is created. Download …?". */
  description: (service: ServiceDetail) => string;
  /** The label of the button that produces the document, e.g. "Download". */
  confirmLabel: string;
  /** Produces the document; the dialog closes as it starts, and failures are reported by a toast. */
  onConfirm: (service: ServiceDetail) => void;
};

/**
 * Offers a service's document at the moment it is needed (the intake receipt once a
 * service is created, …): one click produces it, "Not now" closes the dialog and
 * produces nothing.
 */
export function OfferDocumentDialog({
  service,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
}: OfferDocumentDialogProps) {
  const { t } = useTranslation();

  // The parent clears the service as soon as the dialog closes; keep showing the
  // last one so the text doesn't go blank while the dialog animates out.
  const [shown, setShown] = useState(service);
  if (service && service !== shown) setShown(service);

  return (
    <Dialog open={!!service} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{shown && description(shown)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("Not now")}
          </Button>
          <Button
            onClick={() => {
              if (service) onConfirm(service);
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
