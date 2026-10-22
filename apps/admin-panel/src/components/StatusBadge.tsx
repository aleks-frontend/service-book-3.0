import { useTranslation } from "react-i18next";
import type { Status } from "@servicebook/schemas";
import { STATUS_LABELS } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/** Solid tags; each pair meets WCAG AA in both themes (ADR-0005). */
const STATUS_CLASSES: Record<Status, string> = {
  RECEIVED: "bg-status-received text-status-received-foreground",
  IN_PROGRESS: "bg-status-in-progress text-status-in-progress-foreground",
  COMPLETED: "bg-status-completed text-status-completed-foreground",
  DELIVERED: "bg-status-delivered text-status-delivered-foreground",
  CANCELLED: "bg-status-cancelled text-status-cancelled-foreground",
};

type StatusBadgeProps = {
  status: Status;
  className?: string;
  /** Shown after the status's name, e.g. a dropdown chevron. */
  children?: React.ReactNode;
};

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        // A tag: notched at its start.
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-sm pl-2.5 pr-2 text-xs font-bold [clip-path:polygon(5px_0,100%_0,100%_100%,5px_100%,0_50%)]",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {t(STATUS_LABELS[status])}
      {children}
    </span>
  );
}
