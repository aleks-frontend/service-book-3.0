import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2 } from "lucide-react";
import type { LogEntry } from "@servicebook/schemas";
import { formatDateTime } from "@/lib/format";
import { useServiceLogQuery } from "@/lib/services";
import { NoteForm } from "./NoteForm";
import { PhotoThumbnails } from "./PhotoThumbnails";
import { StatusBadge } from "./StatusBadge";

/**
 * A service's internal log: staff notes, status changes and imported remarks,
 * oldest first, with a box for a new note below. Never shown to the customer.
 */
export function ServiceLog({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { data: entries, isError } = useServiceLogQuery(serviceId);

  return (
    <section className="space-y-4" aria-label={t("Work log")}>
      <p className="text-sm text-muted-foreground">
        {t("Internal notes kept during the work. The customer never sees them.")}
      </p>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the log.")}</p>
      ) : !entries ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("No log entries yet.")}</p>
      ) : (
        <ol className="border-l-2">
          {entries.map((entry) => (
            <LogEntryItem key={entry.id} serviceId={serviceId} entry={entry} />
          ))}
        </ol>
      )}
      <NoteForm serviceId={serviceId} placeholder={t("Add an internal note or photos…")} />
    </section>
  );
}

function LogEntryItem({ serviceId, entry }: { serviceId: string; entry: LogEntry }) {
  const { t } = useTranslation();

  return (
    <li
      className="relative space-y-1 pb-4 pl-4 pt-1 text-sm before:absolute before:-left-[5px] before:top-2.5 before:h-2 before:w-2 before:bg-foreground"
      data-testid="log-entry"
    >
      <LogEntryByline entry={entry} />
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
      {entry.photos.length > 0 && (
        <PhotoThumbnails serviceId={serviceId} photos={entry.photos} className="pt-1" />
      )}
    </li>
  );
}

/** Who made a log entry, and when. */
export function LogEntryByline({ entry }: { entry: LogEntry }) {
  const { t, i18n } = useTranslation();
  const author = entry.author?.name ?? t("Former staff member");

  return (
    <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {entry.type === "LEGACY_REMARK" ? t("Imported from the old app") : author}
      </span>
      <time dateTime={entry.createdAt.toISOString()}>
        {formatDateTime(entry.createdAt, i18n.language)}
      </time>
    </div>
  );
}
