import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

/**
 * Picks out the photos among pasted or dropped files, which can be anything, for a note;
 * any others are skipped with a toast.
 */
export function usePhotosOnly() {
  const { t } = useTranslation();
  return useCallback(
    (files: File[]) => {
      const photos = files.filter((file) => file.type.startsWith("image/"));
      if (photos.length < files.length) toast.error(t("Only photos can be added to a note."));
      return photos;
    },
    [t],
  );
}
