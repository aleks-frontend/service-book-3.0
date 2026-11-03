import { useTranslation } from "react-i18next";
import { NoteForm } from "./NoteForm";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
 */
export function AddPhotosDialog({ serviceId, photos, onClose }: AddPhotosDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
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
          className="flex min-h-0 flex-1 flex-col space-y-0"
        >
          {({ composer, addButton }) => (
            <>
              <DialogBody>{composer}</DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("Cancel")}
                </Button>
                {addButton}
              </DialogFooter>
            </>
          )}
        </NoteForm>
      </DialogContent>
    </Dialog>
  );
}
