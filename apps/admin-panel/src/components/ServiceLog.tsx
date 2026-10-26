import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  LOG_NOTE_MAX,
  logNoteInputSchema,
  type LogEntry,
  type LogNoteInput,
  type LogNoteInputValues,
} from "@servicebook/schemas";
import { formatDateTime } from "@/lib/format";
import { useAddNoteMutation, useServiceLogQuery } from "@/lib/services";
import { usePhotoPicker } from "@/lib/usePhotoPicker";
import { PhotoPicker } from "./PhotoPicker";
import { PhotoThumbnails } from "./PhotoThumbnails";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

/**
 * A service's internal log: staff notes, status changes and imported remarks,
 * oldest first, with a box for a new note below. Never shown to the customer.
 */
export function ServiceLog({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { data: entries, isError } = useServiceLogQuery(serviceId);

  return (
    <section className="space-y-4" aria-label={t("Log")}>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the log.")}</p>
      ) : !entries ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("No log entries yet.")}</p>
      ) : (
        <ol className="border-l-2">
          {entries.map((entry) => (
            <LogEntryItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
      <NoteForm serviceId={serviceId} />
    </section>
  );
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
  const { t, i18n } = useTranslation();
  const author = entry.author?.name ?? t("Former staff member");

  return (
    <li
      className="relative space-y-1 pb-4 pl-4 pt-1 text-sm before:absolute before:-left-[5px] before:top-2.5 before:h-2 before:w-2 before:bg-foreground"
      data-testid="log-entry"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {entry.type === "LEGACY_REMARK" ? t("Imported from the old app") : author}
        </span>
        <time dateTime={entry.createdAt.toISOString()}>
          {formatDateTime(entry.createdAt, i18n.language)}
        </time>
      </div>
      {entry.type === "STATUS_CHANGE" && entry.fromStatus && entry.toStatus ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{t("Status changed")}</span>
          <StatusBadge status={entry.fromStatus} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <StatusBadge status={entry.toStatus} />
        </div>
      ) : (
        entry.text && <p className="whitespace-pre-line">{entry.text}</p>
      )}
      {entry.photos.length > 0 && <PhotoThumbnails photos={entry.photos} className="pt-1" />}
    </li>
  );
}

/** A new note with text, photos or both; Ctrl+Enter (⌘+Enter) adds it too. */
function NoteForm({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
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

  const submit = handleSubmit(({ text }) => {
    if (!canAdd) return;
    addNote.mutate(
      { text, photos: picker.photos },
      {
        onSuccess: () => {
          reset();
          picker.clear();
        },
      },
    );
  });

  return (
    <form className="space-y-2" onSubmit={submit}>
      <label htmlFor="log-note" className="sr-only">
        {t("Note")}
      </label>
      <Textarea
        id="log-note"
        rows={3}
        maxLength={LOG_NOTE_MAX}
        placeholder={t("Add an internal note…")}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        {...register("text")}
      />
      <div className="flex items-start justify-between gap-2">
        <PhotoPicker id="log-photos" picker={picker} disabled={addNote.isPending} />
        <Button type="submit" size="sm" disabled={!canAdd}>
          {addNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {t("Add note")}
        </Button>
      </div>
    </form>
  );
}
