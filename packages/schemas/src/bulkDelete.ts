import { z } from "zod";

/** The most records one bulk delete request may name; it matches the largest page size. */
export const BULK_DELETE_MAX = 50;

/** `POST /api/<records>/bulk-delete`: the ids of the records to delete. */
export const bulkDeleteInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(BULK_DELETE_MAX),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteInputSchema>;

/**
 * What a bulk delete did. Records still in use are kept and listed in
 * `inUseIds`; ids that named no record are in neither list.
 */
export type BulkDeleteResult = {
  deletedIds: string[];
  inUseIds: string[];
};
