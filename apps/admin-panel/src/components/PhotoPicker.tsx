import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Loader2, X } from "lucide-react";
import { PHOTOS_PER_NOTE_MAX } from "@servicebook/schemas";
import type { PhotoPickerState } from "@/lib/usePhotoPicker";
import { Button } from "./ui/button";

/**
 * A button that picks photos (offering the camera on phones), with a preview
 * of each picked one and a way to remove it.
 */
export function PhotoPicker({
  id,
  picker,
  disabled,
}: {
  id: string;
  picker: PhotoPickerState;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { photos, processing, add, remove } = picker;
  const full = photos.length >= PHOTOS_PER_NOTE_MAX;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple
        aria-label={t("Photos for the note")}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Picking the same file again should still count as a change.
          event.target.value = "";
          if (files.length > 0) void add(files);
        }}
      />
      {(photos.length > 0 || processing) && (
        <ul className="flex flex-wrap gap-2" aria-label={t("Picked photos")}>
          {photos.map((photo) => (
            <li key={photo.previewUrl} className="relative">
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="h-16 w-16 rounded-md border object-cover"
              />
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-foreground hover:border-foreground disabled:opacity-50"
                aria-label={t("Remove {{label}}", { label: photo.name })}
                disabled={disabled}
                onClick={() => remove(photo)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
          {processing && (
            <li className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">{t("Preparing photos…")}</span>
            </li>
          )}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="mr-2 h-4 w-4" aria-hidden />
        {t("Add photos")}
      </Button>
    </div>
  );
}
