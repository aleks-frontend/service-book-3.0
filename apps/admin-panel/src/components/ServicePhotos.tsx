import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { useServiceLogQuery } from "@/lib/services";
import { AddPhotosDialog } from "./AddPhotosDialog";
import { DrawerSummaryRow } from "./EntityDrawer";
import { PhotoThumbnails } from "./PhotoThumbnails";
import { Button } from "./ui/button";

/**
 * Every photo in a service's log, oldest first, as a row of its drawer's summary, with an
 * "Add photos" button that picks more and adds them as a note. Nothing until the log has
 * loaded; a log that fails to load says so on the Log tab.
 */
export function ServicePhotos({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedPhotos, setPickedPhotos] = useState<File[] | null>(null);
  const { data: entries } = useServiceLogQuery(serviceId);
  if (!entries) return null;
  const photos = entries.flatMap((entry) => entry.photos);

  return (
    <DrawerSummaryRow label={t("Photos")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {photos.length > 0 ? (
          <PhotoThumbnails serviceId={serviceId} photos={photos} />
        ) : (
          <span className="text-muted-foreground">{t("No photos")}</span>
        )}
        {/* Clicked in the button's own handler: browsers only open a file picker during a user gesture. */}
        {/* No height or padding of its own, so the row is as tall as its neighbours and the button lines up with the text. */}
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto px-0"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t("Add photos")}
        </Button>
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
      </div>
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
