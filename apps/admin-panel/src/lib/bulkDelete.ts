import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import toast from "react-hot-toast";
import { BULK_DELETE_MAX, type BulkDeleteResult } from "@servicebook/schemas";
import { request } from "./http";

/** How many selected records a bulk delete confirmation names before "and N more". */
const NAMED_IN_CONFIRMATION = 3;

/** "A, B, C" or "A, B, C and 4 more", for a bulk delete confirmation. */
export function namesSummary(names: string[], t: TFunction) {
  const named = names.slice(0, NAMED_IN_CONFIRMATION).join(", ");
  const more = names.length - NAMED_IN_CONFIRMATION;
  return more > 0 ? t("{{names}} and {{count}} more", { names: named, count: more }) : named;
}

/** What the batches did; `failed` when a later batch failed after earlier ones went through. */
type BatchedDeleteResult = BulkDeleteResult & { failed: boolean };

/**
 * Sends the ids to `POST <path>/bulk-delete` in batches the API accepts,
 * adding up what each batch deleted and kept.
 */
async function deleteInBatches(path: string, ids: string[]): Promise<BatchedDeleteResult> {
  const result: BatchedDeleteResult = { deletedIds: [], inUseIds: [], failed: false };
  for (let start = 0; start < ids.length; start += BULK_DELETE_MAX) {
    const batch = ids.slice(start, start + BULK_DELETE_MAX);
    try {
      const { deletedIds, inUseIds } = await request<BulkDeleteResult>(`${path}/bulk-delete`, {
        method: "POST",
        body: { ids: batch },
      });
      result.deletedIds.push(...deletedIds);
      result.inUseIds.push(...inUseIds);
    } catch (error) {
      if (start === 0) throw error;
      // The earlier batches are already deleted, so their counts are still worth reporting.
      return { ...result, failed: true };
    }
  }
  return result;
}

type BulkDeleteOptions = {
  /** The records' API path, e.g. "/customers". */
  path: string;
  /** Refetched once the delete is done, even when a later batch failed. */
  listKey: QueryKey;
  /** The query key of one deleted record, dropped from the cache. */
  detailKey?: (id: string) => QueryKey;
  /** The result toast's texts, already translated. */
  messages: {
    deleted: (count: number) => string;
    deletedAndKept: (deleted: number, inUse: number) => string;
    failed: string;
  };
};

/** Deletes any number of records; records still in use are kept and counted in the toast. */
export function useBulkDeleteMutation({ path, listKey, detailKey, messages }: BulkDeleteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => deleteInBatches(path, ids),
    onSuccess: ({ deletedIds, inUseIds, failed }) => {
      if (inUseIds.length > 0) {
        toast(messages.deletedAndKept(deletedIds.length, inUseIds.length));
      } else {
        toast.success(messages.deleted(deletedIds.length));
      }
      if (failed) toast.error(messages.failed);
      if (detailKey) {
        for (const id of deletedIds) queryClient.removeQueries({ queryKey: detailKey(id) });
      }
    },
    onError: () => toast.error(messages.failed),
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}
