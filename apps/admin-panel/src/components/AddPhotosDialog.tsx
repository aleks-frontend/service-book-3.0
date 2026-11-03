import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NoteForm } from "./NoteForm";
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

type AddPhotosDialogProps = {
  /** The service whose log the note is added to. */
  serviceId: string;
  /** The photos picked from the Photos strip, which the note starts with. */
  photos: File[];
  /** Called when the dialog closes, saved or not. */
  onClose: () => void;
};

/**
 * Photos picked from a service's Photos strip, added to its log as a staff note with
 * an optional caption. Shown while open, so each set of photos gets a fresh note.
 * Closing it with photos or text in it asks before discarding them; it can't be closed
 * while the note is saving.
 */
export function AddPhotosDialog({ serviceId, photos, onClose }: AddPhotosDialogProps) {
  const { t } = useTranslation();
  // Picked photos count as a draft before the form first reports one.
  const [draft, setDraft] = useState({ hasDraft: true, saving: false });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const close = () => {
    if (draft.saving) return;
    if (draft.hasDraft) setConfirmingDiscard(true);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("Add photos")}</DialogTitle>
        </DialogHeader>
        <NoteForm
          serviceId={serviceId}
          placeholder={t("What do the photos show? (optional)")}
          initialPhotos={photos}
          autoFocus
          onSaved={onClose}
          onDraftChange={setDraft}
          className="flex min-h-0 flex-1 flex-col space-y-0"
        >
          {({ composer, addButton }) => (
            <>
              <DialogBody>{composer}</DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={draft.saving}>
                  {t("Cancel")}
                </Button>
                {addButton}
              </DialogFooter>
            </>
          )}
        </NoteForm>
        <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("Discard these photos?")}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogDescription>{t("Nothing will be added to the Work log.")}</DialogDescription>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmingDiscard(false)}>
                {t("Keep")}
              </Button>
              <Button variant="destructive" onClick={onClose}>
                {t("Discard")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
