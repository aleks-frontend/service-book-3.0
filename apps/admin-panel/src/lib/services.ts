import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { CursorPage, Service, ServiceInput } from "@servicebook/schemas";
import { request, toSearchParams } from "./http";

export const serviceKeys = {
  all: ["services"] as const,
  list: ["services", "list"] as const,
  detail: (id: string) => ["services", "detail", id] as const,
};

/** Newest first, one cursor page at a time, for infinite scrolling. */
export function useServicesInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: serviceKeys.list,
    queryFn: ({ pageParam }) =>
      request<CursorPage<Service>>(`/services?${toSearchParams({ cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useServiceQuery(id: string | null) {
  return useQuery({
    queryKey: serviceKeys.detail(id ?? ""),
    queryFn: () => request<Service>(`/services/${id}`),
    enabled: id !== null,
  });
}

export function useSaveServiceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ServiceInput }) =>
      id
        ? request<Service>(`/services/${id}`, { method: "PUT", body: input })
        : request<Service>("/services", { method: "POST", body: input }),
    onSuccess: (service, { id }) => {
      toast.success(
        id
          ? t("Service {{number}} updated", { number: service.number })
          : t("Service {{number}} created", { number: service.number }),
      );
      queryClient.setQueryData(serviceKeys.detail(service.id), service);
      return queryClient.invalidateQueries({ queryKey: serviceKeys.list });
    },
    onError: () => toast.error(t("Could not save the service. Please try again.")),
  });
}

export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => request<void>(`/services/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      toast.success(t("Service deleted"));
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: serviceKeys.list });
    },
    onError: () => toast.error(t("Could not delete the service. Please try again.")),
  });
}
