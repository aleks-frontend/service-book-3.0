import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { PHOTOS_PER_NOTE_MAX } from "@servicebook/schemas";
import { processPhoto, type PickedPhoto } from "./photos";

function revokePreviews(photos: PickedPhoto[]) {
  photos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
}

/**
 * The photos picked for one note: each picked file is shrunk as it is added,
 * a file the browser can't read is skipped with a toast naming it, and no more
 * than 10 are kept.
 */
export function usePhotoPicker() {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [processing, setProcessing] = useState(0);
  // Picked and being processed, or kept: what counts towards the limit.
  const taken = useRef(0);
  const latest = useRef(photos);
  latest.current = photos;

  const add = useCallback(
    async (files: File[]) => {
      const room = PHOTOS_PER_NOTE_MAX - taken.current;
      if (files.length > room) {
        toast.error(t("A note can have at most {{max}} photos.", { max: PHOTOS_PER_NOTE_MAX }));
      }
      const accepted = files.slice(0, Math.max(room, 0));
      taken.current += accepted.length;
      setProcessing((count) => count + accepted.length);

      const results = await Promise.allSettled(accepted.map(processPhoto));
      const processed: PickedPhoto[] = [];
      results.forEach((result, n) => {
        if (result.status === "fulfilled") {
          processed.push(result.value);
        } else {
          taken.current--;
          toast.error(
            t('Could not read "{{name}}". Save it as JPEG and try again.', {
              name: accepted[n].name,
            }),
          );
        }
      });
      setPhotos((current) => [...current, ...processed]);
      setProcessing((count) => count - accepted.length);
    },
    [t],
  );

  const remove = useCallback((photo: PickedPhoto) => {
    URL.revokeObjectURL(photo.previewUrl);
    taken.current--;
    setPhotos((current) => current.filter((other) => other !== photo));
  }, []);

  const clear = useCallback(() => {
    revokePreviews(latest.current);
    taken.current = 0;
    setPhotos([]);
  }, []);

  // The previews' object URLs go with the picker.
  useEffect(() => () => revokePreviews(latest.current), []);

  return { photos, processing: processing > 0, add, remove, clear };
}

export type PhotoPickerState = ReturnType<typeof usePhotoPicker>;
