import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { useFileDrop } from "@/lib/fileDrag";
import { usePhotosOnly } from "@/lib/usePhotosOnly";
import { cn } from "@/lib/utils";
import { useServiceLogQuery } from "@/lib/services";
import { AddPhotosDialog } from "./AddPhotosDialog";
import { DrawerSummaryRow } from "./EntityDrawer";
import { PhotoThumbnails } from "./PhotoThumbnails";
import { Button } from "./ui/button";

/**
 * Every photo in a service's log, oldest first, as a row of its drawer's summary: one line
 * of the newest that fit, after a "+N" tile for the older ones, with an add button at its
 * end, named "Add photos", that picks more and adds them as a note. With none, the whole row is a dashed
 * box that picks them. Photos dropped onto the row, in either look, are added as if picked; it is
 * highlighted while files are dragged over it. Nothing until the log has loaded; a log that fails
 * to load says so on the Log tab.
 */
export function ServicePhotos({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const photosOnly = usePhotosOnly();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedPhotos, setPickedPhotos] = useState<File[] | null>(null);
  const { data: entries } = useServiceLogQuery(serviceId);
  const dropTarget = useFileDrop<HTMLDivElement>({
    onFiles(files) {
      const photos = photosOnly(files);
      if (photos.length > 0) setPickedPhotos(photos);
    },
  });
  if (!entries) return null;
  const photos = entries.flatMap((entry) => entry.photos);

  // Called from the buttons' own click handlers: browsers only open a file picker during a user gesture.
  const pick = () => inputRef.current?.click();

  return (
    <DrawerSummaryRow label={t("Photos")}>
      <div
        {...dropTarget}
        data-testid="photos-drop-target"
        // Highlighted like the note composer: the empty box's own border, or a rule around the strip.
        className={cn(
          "group rounded-md",
          photos.length > 0 &&
            "data-[drag-over]:bg-accent data-[drag-over]:outline data-[drag-over]:outline-1 data-[drag-over]:outline-offset-2 data-[drag-over]:outline-primary",
        )}
      >
        {photos.length > 0 ? (
          <div className="flex items-center gap-3">
            {/* Takes the room the button leaves, whatever the tiles in it would need, and fits them to it. */}
            <PhotoThumbnails
              serviceId={serviceId}
              photos={photos}
              compact
              className="min-w-0 flex-1"
            />
            {/* No padding of its own, so it ends where the row's value does. On a phone, the camera alone. */}
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto shrink-0 px-0"
              aria-label={t("Add photos")}
              onClick={pick}
            >
              <Camera className="h-3.5 w-3.5 sm:mr-1" aria-hidden />
              <span className="hidden sm:inline">{t("Add")}</span>
            </Button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t("Add photos")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed bg-card px-3 py-3 text-sm hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background group-data-[drag-over]:border-primary group-data-[drag-over]:bg-accent"
            onClick={pick}
          >
            <Camera className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-semibold">{t("Add photos")}</span>{" "}
              <span className="text-muted-foreground">{t("or drag here")}</span>
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label={t("Photos to add")}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Picking the same file again should still count as a change.
          event.target.value = "";
          if (files.length > 0) setPickedPhotos(files);
        }}
      />
      {pickedPhotos && (
        <AddPhotosDialog
          serviceId={serviceId}
          photos={pickedPhotos}
          onClose={() => setPickedPhotos(null)}
        />
      )}
    </DrawerSummaryRow>
  );
}
