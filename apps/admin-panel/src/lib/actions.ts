import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Action, ActionInput, ActionListQuery, Page } from "@servicebook/schemas";
import { useBulkDeleteMutation } from "./bulkDelete";
import { request, toSearchParams, type HttpError } from "./http";

const actionKeys = {
  all: ["actions"] as const,
  list: (query: ActionListQuery) => ["actions", "list", query] as const,
};

/** One page of the price list; keeps showing the previous page while the next one loads. */
export function useActionsQuery(query: ActionListQuery, { enabled = true } = {}) {
  return useQuery({
    queryKey: actionKeys.list(query),
    queryFn: () => request<Page<Action>>(`/actions?${toSearchParams(query)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSaveActionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ActionInput }) =>
      id
        ? request<Action>(`/actions/${id}`, { method: "PUT", body: input })
        : request<Action>("/actions", { method: "POST", body: input }),
    onSuccess: (_action, { id }) => {
      toast.success(id ? t("Action updated") : t("Action created"));
      return queryClient.invalidateQueries({ queryKey: actionKeys.all });
    },
    onError: () => toast.error(t("Could not save the action. Please try again.")),
  });
}

export function useDeleteActionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/actions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("Action deleted"));
      return queryClient.invalidateQueries({ queryKey: actionKeys.all });
    },
    onError: (error: HttpError) =>
      toast.error(
        error.code === "ACTION_IN_USE"
          ? t("This action is used on a service, so it cannot be deleted.")
          : t("Could not delete the action. Please try again."),
      ),
  });
}

/** Deletes any number of actions; actions still in use are kept and counted. */
export function useBulkDeleteActionsMutation() {
  const { t } = useTranslation();

  return useBulkDeleteMutation({
    path: "/actions",
    listKey: actionKeys.all,
    messages: {
      deleted: (count) => t("Actions deleted: {{count}}", { count }),
      deletedAndKept: (deleted, inUse) =>
        t("Actions deleted: {{deleted}}. Kept because they are in use: {{inUse}}.", {
          deleted,
          inUse,
        }),
      failed: t("Could not delete the actions. Please try again."),
    },
  });
}
