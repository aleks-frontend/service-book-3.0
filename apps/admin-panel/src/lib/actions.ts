import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Action, ActionInput } from "@servicebook/schemas";
import { request } from "./http";

const actionKeys = {
  all: ["actions"] as const,
};

/** The whole price list, sorted by name; searching it happens client-side. */
export function useActionsQuery() {
  return useQuery({
    queryKey: actionKeys.all,
    queryFn: () => request<Action[]>("/actions"),
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
    onError: () => toast.error(t("Could not delete the action. Please try again.")),
  });
}
