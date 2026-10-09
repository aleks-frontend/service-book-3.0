import type { Status } from "@servicebook/schemas";

/** The translation key of each status's name. */
export const STATUS_LABELS: Record<Status, string> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
