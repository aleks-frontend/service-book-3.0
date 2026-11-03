import { useEffect, useId, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  LOG_NOTE_MAX,
  logNoteInputSchema,
  type LogNoteInput,
  type LogNoteInputValues,
} from "@servicebook/schemas";
import { useAddNoteMutation } from "@/lib/services";
import { usePhotoPicker } from "@/lib/usePhotoPicker";
import { NoteComposer } from "./NoteComposer";
import { Button } from "./ui/button";

type NoteFormProps = {
  /** The service whose log the note is added to. */
  serviceId: string;
  /** The text's placeholder. */
  placeholder: string;
  /** Photos the note starts with, shrunk and counted towards the limit as if picked; read once, on mount. */
  initialPhotos?: File[];
  /** Whether the text takes the focus when the form appears. */
  autoFocus?: boolean;
  /** Called once the note is added and the form cleared. */
  onSaved?: () => void;
};

/**
 * A new staff note with text, photos or both, added to the service's log;
 * Ctrl+Enter (⌘+Enter) adds it too. The text and photos are cleared once it is added.
 */
export function NoteForm({
  serviceId,
  placeholder,
  initialPhotos,
  autoFocus,
  onSaved,
}: NoteFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const addNote = useAddNoteMutation(serviceId);
  const picker = usePhotoPicker();
  const { register, handleSubmit, reset, watch } = useForm<
    LogNoteInputValues,
    unknown,
    LogNoteInput
  >({
    // zodResolver submits the schema's parsed output (blank text as null), but
    // @hookform/resolvers v3 only types it as the input.
    resolver: zodResolver(logNoteInputSchema) as Resolver<
      LogNoteInputValues,
      unknown,
      LogNoteInput
    >,
    defaultValues: { text: "" },
  });
  const hasContent = (watch("text") ?? "").trim() !== "" || picker.photos.length > 0;
  const canAdd = hasContent && !picker.processing && !addNote.isPending;

  // Added once, even when Strict Mode runs effects twice.
  const initialPhotosAdded = useRef(false);
  const { add } = picker;
  useEffect(() => {
    if (initialPhotosAdded.current || !initialPhotos?.length) return;
    initialPhotosAdded.current = true;
    void add(initialPhotos);
  }, [add, initialPhotos]);

  const submit = handleSubmit(({ text }) => {
    if (!canAdd) return;
    addNote.mutate(
      { text, photos: picker.photos },
      {
        onSuccess: () => {
          reset();
          picker.clear();
          onSaved?.();
        },
      },
    );
  });

  return (
    <form className="space-y-2" onSubmit={submit}>
      <label htmlFor={`${id}-note`} className="sr-only">
        {t("Note")}
      </label>
      <NoteComposer
        textarea={{
          id: `${id}-note`,
          rows: 3,
          maxLength: LOG_NOTE_MAX,
          placeholder,
          autoFocus,
          onKeyDown: (event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          },
          ...register("text"),
        }}
        picker={picker}
        photosId={`${id}-photos`}
        disabled={addNote.isPending}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canAdd}>
          {addNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {t("Add note")}
        </Button>
      </div>
    </form>
  );
}
