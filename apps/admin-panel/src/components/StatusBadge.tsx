import { useTranslation } from "react-i18next";
import type { Status } from "@servicebook/schemas";
import { cn } from "@/lib/utils";

/** The translation key of each status's name. */
const STATUS_LABELS: Record<Status, string> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_CLASSES: Record<Status, string> = {
  RECEIVED: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-slate-200 text-slate-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {t(STATUS_LABELS[status])}
    </span>
  );
}
