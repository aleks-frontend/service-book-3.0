import { z } from "zod";
import { statusSchema } from "./service.js";

/**
 * A staff note, an automatic record of a status change, or a `remark`
 * imported from the old Firebase app (see GLOSSARY.md: Log entry).
 */
export const LOG_ENTRY_TYPES = ["NOTE", "STATUS_CHANGE", "LEGACY_REMARK"] as const;
export const logEntryTypeSchema = z.enum(LOG_ENTRY_TYPES);
export type LogEntryType = z.infer<typeof logEntryTypeSchema>;

/** The longest note a staff member may add. */
export const LOG_NOTE_MAX = 5000;

/** What a staff member writes when adding a note to a service's log. */
export const logNoteInputSchema = z.object({
  text: z.string().trim().min(1).max(LOG_NOTE_MAX),
});

export type LogNoteInput = z.infer<typeof logNoteInputSchema>;

/** `PUT /api/services/:id/status`: the service's new status. */
export const statusChangeInputSchema = z.object({
  status: statusSchema,
});

export type StatusChangeInput = z.infer<typeof statusChangeInputSchema>;

export const logEntrySchema = z.object({
  id: z.string(),
  type: logEntryTypeSchema,
  /** A note's or legacy remark's text; null on a status change. */
  text: z.string().nullable(),
  /** Set on status changes only. */
  fromStatus: statusSchema.nullable(),
  /** Set on status changes only. */
  toStatus: statusSchema.nullable(),
  /** The staff member who wrote the note or changed the status; null on a legacy remark. */
  author: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.coerce.date(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;
