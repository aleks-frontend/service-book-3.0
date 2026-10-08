import type { RequestHandler } from "express";
import { bulkDeleteInputSchema, type BulkDeleteResult } from "@servicebook/schemas";
import { isForeignKeyViolation, isNotFound, parseBody } from "./routeHelpers.js";

/** Deletes one record by id, throwing Prisma's errors for a missing or still-referenced record. */
type DeleteOne = (id: string) => Promise<unknown>;

/**
 * Deletes the records one by one, so a record still in use is kept without
 * failing the rest. Ids that name no record (or were already deleted earlier
 * in the list) are skipped.
 */
export async function deleteEach(ids: string[], deleteOne: DeleteOne): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deletedIds: [], inUseIds: [] };
  for (const id of new Set(ids)) {
    try {
      await deleteOne(id);
      result.deletedIds.push(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) result.inUseIds.push(id);
      else if (!isNotFound(error)) throw error;
    }
  }
  return result;
}

/**
 * `POST /bulk-delete` with `{ ids }` (at most `BULK_DELETE_MAX`), answering
 * with what was deleted and what is still in use.
 */
export function bulkDeleteHandler(label: string, deleteOne: DeleteOne): RequestHandler {
  return async (req, res) => {
    const input = parseBody(bulkDeleteInputSchema, req, res, label);
    if (!input) return;

    res.json(await deleteEach(input.ids, deleteOne));
  };
}
