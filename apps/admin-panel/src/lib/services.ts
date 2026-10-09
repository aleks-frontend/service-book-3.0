import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type {
  CursorPage,
  LogEntry,
  Service,
  ServiceDetail,
  ServiceInput,
  ServiceLine,
  ServiceLineInput,
  ServiceLineUpdate,
  Status,
} from "@servicebook/schemas";
import { request, toSearchParams, type HttpError } from "./http";

export const serviceKeys = {
  all: ["services"] as const,
  list: ["services", "list"] as const,
  detail: (id: string) => ["services", "detail", id] as const,
  log: (id: string) => ["services", "log", id] as const,
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
    queryFn: () => request<ServiceDetail>(`/services/${id}`),
    enabled: id !== null,
  });
}

export function useSaveServiceMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ServiceInput }) =>
      id
        ? request<ServiceDetail>(`/services/${id}`, { method: "PUT", body: input })
        : request<ServiceDetail>("/services", { method: "POST", body: input }),
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

/**
 * Adds, edits, removes or reorders one service's lines. Each change refetches
 * the service (for its lines and total) and the list (for its total).
 */
export function useServiceLineMutations(serviceId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const lines = `/services/${serviceId}/lines`;

  function refetch() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) }),
      queryClient.invalidateQueries({ queryKey: serviceKeys.list }),
    ]);
  }

  const add = useMutation({
    mutationFn: (input: ServiceLineInput) =>
      request<ServiceLine>(lines, { method: "POST", body: input }),
    onSuccess: refetch,
    onError: () => toast.error(t("Could not add the line. Please try again.")),
  });

  const update = useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: ServiceLineUpdate }) =>
      request<ServiceLine>(`${lines}/${lineId}`, { method: "PATCH", body: input }),
    onSuccess: refetch,
    onError: () => toast.error(t("Could not save the line. Please try again.")),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => request<void>(`${lines}/${lineId}`, { method: "DELETE" }),
    onSuccess: refetch,
    onError: (error: HttpError) =>
      toast.error(
        error.status === 404
          ? t("This line was already removed.")
          : t("Could not remove the line. Please try again."),
      ),
  });

  const reorder = useMutation({
    mutationFn: (lineIds: string[]) =>
      request<ServiceLine[]>(`${lines}/order`, { method: "PUT", body: { lineIds } }),
    onSuccess: refetch,
    // Someone else may have added or removed a line meanwhile; show the current ones.
    onError: () => {
      toast.error(t("Could not reorder the lines. Please try again."));
      return refetch();
    },
  });

  return { add, update, remove, reorder };
}

/**
 * Moves a service to another status. The server logs the change, so the
 * service's log is refetched along with the list.
 */
export function useChangeStatusMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      request<ServiceDetail>(`/services/${id}/status`, { method: "PUT", body: { status } }),
    onSuccess: (service) => {
      queryClient.setQueryData(serviceKeys.detail(service.id), service);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.list }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.log(service.id) }),
      ]);
    },
    onError: () => toast.error(t("Could not change the status. Please try again.")),
  });
}

/** A service's log, oldest entry first. */
export function useServiceLogQuery(serviceId: string) {
  return useQuery({
    queryKey: serviceKeys.log(serviceId),
    queryFn: () => request<LogEntry[]>(`/services/${serviceId}/log`),
  });
}

/** Adds a staff member's note to the end of a service's log. */
export function useAddNoteMutation(serviceId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (text: string) =>
      request<LogEntry>(`/services/${serviceId}/log`, { method: "POST", body: { text } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.log(serviceId) }),
    onError: () => toast.error(t("Could not add the note. Please try again.")),
  });
}
