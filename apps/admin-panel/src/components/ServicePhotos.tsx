import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { useServiceLogQuery } from "@/lib/services";
import { AddPhotosDialog } from "./AddPhotosDialog";
import { PhotoThumbnails } from "./PhotoThumbnails";
import { Button } from "./ui/button";

/**
 * Every photo in a service's log, oldest first, near the top of its drawer, under a
 * header whose "Add photos" button picks more and adds them as a note. Nothing until the
 * log has loaded; a log that fails to load says so on the Log tab.
 */
export function ServicePhotos({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedPhotos, setPickedPhotos] = useState<File[] | null>(null);
  const { data: entries } = useServiceLogQuery(serviceId);
  if (!entries) return null;
  const photos = entries.flatMap((entry) => entry.photos);

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {t("Photos")}
        </h3>
        {/* Clicked in the button's own handler: browsers only open a file picker during a user gesture. */}
        <Button type="button" variant="link" size="xs" onClick={() => inputRef.current?.click()}>
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
      {photos.length > 0 && <PhotoThumbnails serviceId={serviceId} photos={photos} />}
      {pickedPhotos && (
        <AddPhotosDialog
          serviceId={serviceId}
          photos={pickedPhotos}
          onClose={() => setPickedPhotos(null)}
        />
      )}
    </section>
  );
}
