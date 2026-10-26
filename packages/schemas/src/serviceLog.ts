import { z } from "zod";
import { photoSchema } from "./photo.js";
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

/**
 * The text of a note added to a service's log; blank becomes null. A note
 * needs text or photos, which only the route can check, as the photos travel
 * as files beside it.
 */
export const logNoteInputSchema = z.object({
  text: z
    .string()
    .trim()
    .max(LOG_NOTE_MAX)
    .nullish()
    .transform((text) => text || null),
});

export type LogNoteInputValues = z.input<typeof logNoteInputSchema>;
export type LogNoteInput = z.output<typeof logNoteInputSchema>;

/** `PUT /api/services/:id/status`: the service's new status. */
export const statusChangeInputSchema = z.object({
  status: statusSchema,
});

export type StatusChangeInput = z.infer<typeof statusChangeInputSchema>;

export const logEntrySchema = z.object({
  id: z.string(),
  type: logEntryTypeSchema,
  /** A note's or legacy remark's text; null on a status change and on a note with only photos. */
  text: z.string().nullable(),
  /** Set on status changes only. */
  fromStatus: statusSchema.nullable(),
  /** Set on status changes only. */
  toStatus: statusSchema.nullable(),
  /** The staff member who wrote the note or changed the status; null on a legacy remark. */
  author: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** A note's photos, in the order they were picked; empty on every other entry. */
  photos: z.array(photoSchema),
  createdAt: z.coerce.date(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;
