import { useRef, useState, type DragEvent, type Ref } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Camera, Loader2, X } from "lucide-react";
import { PHOTOS_PER_NOTE_MAX } from "@servicebook/schemas";
import type { PhotoPickerState } from "@/lib/usePhotoPicker";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Textarea, type TextareaProps } from "./ui/textarea";

type NoteComposerProps = {
  /** The text's props: its registered field, id, placeholder, key handlers and so on. */
  textarea: TextareaProps & { ref?: Ref<HTMLTextAreaElement> };
  /** The note's photos, held by the caller. */
  picker: PhotoPickerState;
  /** The id of the hidden file input that picks the photos. */
  photosId: string;
  /** Whether the note is being saved, which locks its photos. */
  disabled?: boolean;
};

/**
 * One bordered box holding a staff note being written: its text, previews of
 * its picked photos and a toolbar with a button that picks more (offering the
 * camera on phones) and, once any are picked, a count of them out of the most
 * allowed. The box shows focus while the text has it, and clicking an empty
 * part of it puts the cursor in the text. Photos pasted into the text or
 * dropped onto the box are added as if picked; the box is highlighted while
 * files are dragged over it.
 */
export function NoteComposer({ textarea, picker, photosId, disabled }: NoteComposerProps) {
  const { t } = useTranslation();
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { photos, processing, add, remove } = picker;
  const full = photos.length >= PHOTOS_PER_NOTE_MAX;
  const { ref: fieldRef, className, ...textareaProps } = textarea;
  // Entering a child fires before leaving the box, so a drag is over the box until the count is back at 0.
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  function setTextRef(element: HTMLTextAreaElement | null) {
    textRef.current = element;
    if (typeof fieldRef === "function") fieldRef(element);
    else if (fieldRef) (fieldRef as { current: HTMLTextAreaElement | null }).current = element;
  }

  /** Adds the photos among pasted or dropped files as if picked; any other files are skipped with a toast. */
  function addPhotos(files: File[]) {
    const photos = files.filter((file) => file.type.startsWith("image/"));
    if (photos.length < files.length) toast.error(t("Only photos can be added to a note."));
    if (photos.length > 0) void add(photos);
  }

  /** Whether a drag carries files, as opposed to, say, selected text, which is left to the browser. */
  function carriesFiles(event: DragEvent) {
    return event.dataTransfer.types.includes("Files");
  }

  return (
    <div
      data-testid="note-composer"
      data-drag-over={dragOver && !disabled ? "" : undefined}
      className="cursor-text rounded-md border border-input bg-card has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-1 has-[textarea:focus-visible]:ring-offset-background data-[drag-over]:border-primary data-[drag-over]:bg-accent"
      onClick={(event) => {
        if (!(event.target as Element).closest("button, input, textarea, li")) {
          textRef.current?.focus();
        }
      }}
      onDragEnter={(event) => {
        if (!carriesFiles(event)) return;
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        // Taken over even while saving, so the browser doesn't open the file in place of the app.
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        if (!disabled) addPhotos([...event.dataTransfer.files]);
      }}
    >
      <Textarea
        ref={setTextRef}
        className={cn(
          "border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
        {...textareaProps}
        onPaste={(event) => {
          textareaProps.onPaste?.(event);
          const files = [...event.clipboardData.files];
          // Text is left to the browser, and so is everything while the note is saving.
          if (files.length === 0 || disabled) return;
          // A file copied in a file manager carries its name as text, which mustn't land in the note.
          event.preventDefault();
          addPhotos(files);
        }}
      />
      <input
        ref={inputRef}
        id={photosId}
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
        <ul className="flex flex-wrap gap-2 px-3 pb-1 pt-2" aria-label={t("Picked photos")}>
          {photos.map((photo) => (
            <li key={photo.previewUrl} className="relative cursor-default">
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
            <li className="flex h-16 w-16 cursor-default items-center justify-center rounded-md border border-dashed">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">{t("Preparing photos…")}</span>
            </li>
          )}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled || full}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-1.5 h-4 w-4" aria-hidden />
          {t("Photos")}
        </Button>
        {photos.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            <span aria-hidden>
              {photos.length}/{PHOTOS_PER_NOTE_MAX}
            </span>
            <span className="sr-only">
              {t("{{n}} of {{max}} photos", { n: photos.length, max: PHOTOS_PER_NOTE_MAX })}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
